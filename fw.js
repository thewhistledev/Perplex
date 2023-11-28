const { Client, GatewayIntentBits, CommandInteraction, ActivityType, EmbedBuilder } = require('discord.js'); // DiscordJS Library
const ping = require('ping'); // Ping Library
const { performance } = require('perf_hooks'); //Network & Performance Lib
const tcpPing = require('tcp-ping'); // TCP Analyser
const geoip = require('geoip-lite'); // IP 2 Location
const dns = require('dns'); // DNS Resolver Library
const config = require('./conf.json'); // Configuration for Bot (Token, Name, Etc..)
const preventCrash = require('./utils/handler.js'); // Handwritten Crash Handler
const { Log } = require('./utils/loghandler.js'); // Prints prefixes and suffixes to outputs.
const axios = require('axios'); //I think this is a web server framework lmao like curl.


function reverseString(str) { //reverse string, should be obvious by the name.
  return str.split('').reverse().join('');
}



async function checkNameservers(host) { // supposed to check nameservers of a dns host but fails cuz im ded #Fix
  try {
    const { ns } = (await dns.promises.resolveNs(host)).toString();
    return ns;
  } catch (error) {
    Log('warn','Error retrieving nameservers:', error);
    return null;
  }
}

async function reverseDNS(ipAddress) { //reverses the ip into a FQDN (Fully Qualified Domain Name)
  try {
    const hostnames = await dns.promises.reverse(ipAddress);
    return hostnames.join(', ');
  } catch (error) {
    Log('warn', 'Error performing reverse DNS:', error);
    return null;
  }
}


async function fetchWHOISData(domain) {
  try {
    const options = {
      method: 'GET',
      url: `https://whoisjson.com/api/v1/whois?domain=${domain}&format=json`,
      headers: {
        'Authorization': `Token=${config.whoisapikey}` // Replace with your actual API token
      }
    };

    const response = await axios.request(options);
    if (typeof response.data === 'string') {
      return JSON.parse(response.data); // Parse string to JSON
    }
    return response.data; // Directly return the object if already in JSON format
  } catch (error) {
    console.error('Error fetching WHOIS data:', error);
    return null;
  }
}



function isNullOrUndefined(obj) {
  return obj === null || obj === undefined;
}



preventCrash;

const TOKEN = atob(reverseString(config.toktok)); //make sure you pre-encode your token with base64 and reverse the string before creating your conf.json file

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageTyping] }); //Discord Client API

const commands = [ // Discord Slash Commands List
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
        name: 'domain',
        description: 'Domain to check',
        type: 3, // 3 = String
        required: true,
      },
    ],
  },
  {
    name: 'ban',
    description: 'Ban a user from the server',
    options: [
        {
            name: 'user',
            description: 'The user you want to ban',
            type: 6,
            required: true
        },
        {
            name: 'reason',
            description: 'The reason for the ban',
            type: 3,
            required: true
        }
    ]
  },
  {
    name: 'kick',
    description: 'Kick a user from the server',
    options: [
        {
            name: 'user',
            description: 'The user you want to kick',
            type: 6,
            required: true
        },
        {
            name: 'reason',
            description: 'The reason for the kick',
            type: 3,
            required: true
        }
    ]
  },
];

async function whoisCommand(interaction) {
  const domain = interaction.options.getString('domain');
  const whoisData = await fetchWHOISData(domain);

  if (!whoisData) {
    return interaction.reply({ content: 'Failed to fetch WHOIS data for the domain.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`WHOIS Information for ${domain}`)
    .addFields(
      { name: 'Domain Name', value: isNullOrUndefined(whoisData.name) ? "N/A" :  whoisData.name, inline: true },
      { name: 'Registrar', value: isNullOrUndefined(whoisData.registrar.name) ? "N/A" :  whoisData.registrar.name, inline: false },
      { name: 'Registrar Url', value: isNullOrUndefined(whoisData.registrar.url) ? "N/A" :  whoisData.registrar.url, inline: true },
      { name: 'Creation Date', value: isNullOrUndefined(whoisData.created) ? "N/A" :  whoisData.created, inline: true },
      { name: 'Expiration Date', value: isNullOrUndefined(whoisData.expires) ? "N/A" :  whoisData.expires, inline: true },
      { name: 'Last Updated', value: isNullOrUndefined(whoisData.changed) ? "N/A" :  whoisData.changed, inline: true },
      { name: 'Status', value: isNullOrUndefined(whoisData.status) ? "N/A" :  `${whoisData.status}`.replace(",", "\n").replace(/,/g, "\n"), inline: false },
      { name: 'Name Servers', value: isNullOrUndefined(whoisData.nameserver) ? "N/A" : `${whoisData.nameserver}`.replace(/,/g, "\n"), inline: false },
      { name: 'IP Address', value: isNullOrUndefined(whoisData.ips) ? "N/A" : whoisData.ips, inline: true },
      // Additional fields can be added as needed
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}



async function registerCommands() { //Syncs Slash Commands with Discord API so bot doesn't shit itself
  try {
    Log('debug','Started refreshing application (/) commands.');
    await client.application.commands.set(commands);
    Log('debug','Successfully reloaded application (/) commands.');
  } catch (error) {
    Log('error', error);
  }
}

async function pingDNS(host) { //Pings a DNS host and returns time in milliseconds (ms)
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
    await interaction.deferReply(); // Discord bots have something like a "timer" to execute commands, this resets the timer in a sense so it can finish executing long commands.

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
    const nameservers = await checkNameservers(serviceUrl); // again this doesn't work #Fix
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
      if ((await nameservers)) { // Iterates through all nameservers known to the host, doesn't currently work #Fix
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
    const pingResult = await ping.promise.probe('1.1.1.1'); // Checks the bot's capability to ping anything (basically checks if network is down on host machine before trying commands)
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
  if (command === 'ban') {
    const userToBan = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    if(!interaction.member.permissions.has("ADMINISTRATOR")) return; // stops weirdos that try using restricted commands without admin perms.
    if(!interaction.guild.members.me.permissions.has("BAN_MEMBERS")) return;
    // Send embed to user
    const embed = new EmbedBuilder()
      .setTitle('Ban Notice')
      .setDescription(`You have been banned from ${interaction.guild.name} for: ${reason}`)
      .setColor('#FF0000');

    await userToBan.send({ embeds: [embed] });

    // Ban the user
    await interaction.guild.members.ban(userToBan, { reason });
    await interaction.reply({ content: `${userToBan} has been banned for: ${reason}`, ephemeral: true });
    console.log('%s has been banned from %s\nReason: %s', userToBan.displayName, interaction.guild.name, reason);
  }
  
  if (command === 'kick') {
    const userToKick = interaction.options.getMember("user");
    const reason = interaction.options.getString('reason');
    if(!interaction.member.permissions.has("ADMINISTRATOR")) return;
    if(!interaction.guild.members.me.permissions.has("KICK_MEMBERS")) return;
    // Send embed to user
    const embed = new EmbedBuilder()
      .setTitle('Kick Notice')
      .setDescription(`You have been kicked from ${interaction.guild.name} for: ${reason}`)
      .setColor('#FFA500');

    await userToKick.send({ embeds: [embed] });

    // Kick the user
    const member = interaction.guild.members.cache.get(userToKick.id);
    await member.kick(reason);
    await interaction.reply({ content: `${userToKick} has been kicked for: ${reason}`, ephemeral: true });
    console.log('%s has been kicked from %s\nReason: %s', userToKick.displayName, interaction.guild.name, reason);
  }
});

client.login(TOKEN); // Logs into Discord API OAuth for Bot to initialise the connection.. Without this there is no bot.


//Let's test it

// Seems im dumb lets test that instead