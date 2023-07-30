const { Client, GatewayIntentBits, CommandInteraction, ActivityType, EmbedBuilder } = require('discord.js');
const ping = require('ping');
const { performance } = require('perf_hooks');
const tcpPing = require('tcp-ping');
const geoip = require('geoip-lite');
const dns = require('dns');
const config = require('./conf.json');
const preventCrash = require('./utils/handler.js');
const { Log } = require('./utils/loghandler.js');
const axios = require('axios');


function reverseString(str) {
  return str.split('').reverse().join('');
}



async function checkNameservers(host) {
  try {
    const { ns } = (await dns.promises.resolveNs(host)).toString();
    return ns;
  } catch (error) {
    Log('warn','Error retrieving nameservers:', error);
    return null;
  }
}

async function reverseDNS(ipAddress) {
  try {
    const hostnames = await dns.promises.reverse(ipAddress);
    return hostnames.join(', ');
  } catch (error) {
    Log('warn', 'Error performing reverse DNS:', error);
    return null;
  }
}

async function fetchWHOISData(host) {
  try {
    const apiUrl = `https://whoisjsonapi.com/v1/${host}`;
    const headers = {
      "Authorization": 'Bearer AMUyY8I1tMT0fmOTPBie9Qf0PrwsKF2IuQbxe_qwrKuvPK1hkhC9_x7F4VcP2xF',
      "Content-type": "application/json",
    };

    const response = await axios.get(apiUrl, { headers });

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error('Failed to fetch WHOIS data\nStatus Recieved: '+response.status);
    }
  } catch (error) {
    throw error + "\nStatus Recieved: " + response.status;
  }
}




preventCrash;

const TOKEN = atob(reverseString(config.toktok)); //make sure you pre-encode your token with base64 and reverse the string before creating your conf.json file

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageTyping] });

const commands = [
  {
    name: 'check',
    description: 'Check the status of a service',
    options: [
      {
        name: 'host',
        description: 'Hostname to check',
        type: 3, // 3 = String
        required: true,
      },
    ],
  },
  {
    name: 'icmpcheck',
    description: 'Check the status of ICMP Probe',
  },
  {
    name: 'whois', // New command for WHOIS
    description: 'Get WHOIS information for a domain',
    options: [
      {
        name: 'host',
        description: 'Domain to check',
        type: 3, // 3 = String
        required: true,
      },
    ],
  },
];

async function whoisCommand(interaction) {
  const domain = interaction.options.getString('host');

  try {
    // Fetch WHOIS data
    const whoisData = await fetchWHOISData(domain);

    // Create an embed with the WHOIS information
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`WHOIS Information for ${whoisData.domain.domain}`)
      .addField('Registrar', whoisData.registrar.name)
      .addField('Created Date', new Date(whoisData.domain.created_date).toUTCString())
      .addField('Updated Date', new Date(whoisData.domain.updated_date).toUTCString())
      .addField('Expiration Date', new Date(whoisData.domain.expiration_date).toUTCString())
      .addField('Status', whoisData.domain.status.join(', '))
      .addField('Name Servers', whoisData.domain.name_servers.join(', '))
      .addField('Registrant', `${whoisData.registrant.name} (${whoisData.registrant.organization})`)
      .addField('Administrative Contact', `${whoisData.administrative.name} (${whoisData.administrative.organization})`)
      .addField('Technical Contact', `${whoisData.technical.name} (${whoisData.technical.organization})`)
      .setTimestamp();

    // Send the embed as the reply
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    Log('warn', 'Error fetching WHOIS data:', error.message);
    await interaction.reply('Error fetching WHOIS data for the domain.');
  }
}

async function registerCommands() {
  try {
    Log('debug','Started refreshing application (/) commands.');
    await client.application.commands.set(commands);
    Log('debug','Successfully reloaded application (/) commands.');
  } catch (error) {
    Log('error', error);
  }
}

async function pingDNS(host) {
  const dnsPingStartTime = performance.now();
  try {
    await dns.promises.resolve(host);
  } catch (error) {
    return "DNS Resolution Failed."
  }
  const dnsPingEndTime = performance.now();
  return dnsPingEndTime.toFixed(0) - dnsPingStartTime.toFixed(0) + "ms";
}

client.once('ready', () => {
  Log('info' ,'Perplex is ready to go!');
  registerCommands();
  client.user.setPresence({ activities: [{ name: "Any network's status.", type: ActivityType.Watching }], status: 'dnd' });
  client.user.setStatus('dnd');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = interaction.commandName;
  if (command === 'check') {
    const serviceUrl = interaction.options.getString('host');
    if(!serviceUrl.match(/^((?:([a-z0-9]\.|[a-z0-9][a-z0-9\-]{0,61}[a-z0-9])\.)+)([a-z0-9]{2,63}|(?:[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]))\.?$/) && !serviceUrl.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)){
      await interaction.reply('Invalid Hostname or IP Address.');
      return;
    }
    // Defer the reply
    await interaction.deferReply();

    // Get country from IP address
    const ipAddress = serviceUrl.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/) ? serviceUrl : (await ping.promise.probe(serviceUrl)).numeric_host;
    const country = geoip.lookup(ipAddress)?.country || 'Unknown';
    

    // Check ICMP ping
    const pingStartTime = performance.now();
    const pingResult = await ping.promise.probe(serviceUrl);
    const pingEndTime = performance.now();
    const pingTime = pingEndTime - pingStartTime;
    const icmpStatus = pingResult.alive ? '<:hostup:1118660234781659287>' : '<:hostdown:1118660232634191872>';
    const reverseDNSResult = await reverseDNS(ipAddress);
    // Check TCP ping
    const tcpPingStartTime = performance.now();
    const tcpPingResult = await new Promise((resolve, reject) => {
      tcpPing.ping({ address: serviceUrl, port: 80, timeout: 200 }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
    const tcpPingEndTime = performance.now();
    const tcpPingTime = tcpPingEndTime - tcpPingStartTime;
    const tcpPingStatus = tcpPingResult.results[0].err ? '<:hostdown:1118660232634191872>' : '<:hostup:1118660234781659287>';
    const nameservers = await checkNameservers(serviceUrl);
    // Create an embed with the status information
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Host Status')
      .addFields(
        { name: 'ICMP Ping', value: icmpStatus, inline: true },
        { name: 'TCP Ping', value: tcpPingStatus, inline: true },
        { name: 'TCP Ping Time', value: tcpPingTime.toFixed(0) + 'ms', inline: true },
        { name: 'Country', value: country, inline: true },
        { name: 'Host', value: pingResult.host ? pingResult.host : 'N/A', inline: true },
        { name: 'IP', value: pingResult.numeric_host ? pingResult.numeric_host : 'N/A', inline: true },
        { name: 'Packet Loss', value: pingResult.packetLoss.split('.')[0] ? pingResult.packetLoss.split('.')[0] + '%' : '0%', inline: true },
        { name: 'DNS Resolver', value: (await pingDNS(serviceUrl)).toString(), inline: true},
        { name: 'Reverse DNS', value: reverseDNSResult || "Unavailable", inline: true}
      )
      .setAuthor({ name: "Requested by "+interaction.member.user.username, iconUrl: interaction.member.user.avatarURL()})
      .setFooter({ text: 'Created by WhistleDev'})
      .setTimestamp();
      if ((await nameservers)) {
        nameservers.forEach((nameserver, i) => {
          embed.addFields({name: `NS${i + 1}`, value: nameserver, inline: false});
        });
      } else {
        nameservers => array.forEach(element => {
          console.log(element);
        })
        embed.addFields({name: 'Nameservers', value: 'No nameservers found', inline: false});
      }
    await interaction.editReply({ embeds: [embed] });
  }

  if (command === 'icmpcheck') {
    // Defer the reply
    await interaction.deferReply();

    // Check ICMP ping
    const pingStartTime = performance.now();
    const pingResult = await ping.promise.probe('1.1.1.1'); // Random IP address
    const pingEndTime = performance.now();
    const pingTime = pingEndTime - pingStartTime;
    if(!pingResult.alive) pingTime = 9999;
    const icmpStatus = pingResult.alive ? 'Is operating normally.' : 'Is experiencing issues.';

    // Send the reply
    await interaction.editReply('ICMP Probe ' + icmpStatus + '\nResponse time: ' + pingTime.toFixed(0) + 'ms');
  }
  if (command === 'whois') {
  // Handle the /whois command
  await whoisCommand(interaction);
  }
});

client.login(TOKEN);
