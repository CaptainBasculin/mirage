import Discord, { TextChannel } from 'discord.js'
import { User } from '../database/entities/User'
import { Invite } from '../database/entities/Invite'
import useragent from 'useragent'
import { Image } from '../database/entities/Image'

const client = new Discord.Client({
  fetchAllMembers: true
})

let logChannel: TextChannel

client.on('ready', async () => {
  console.log('Discord bot ready')
  logChannel = client.channels.get(process.env.DISCORD_LOGS!) as TextChannel
})

export async function botLogin() {
  return client.login(process.env.DISCORD_TOKEN)
}
export async function userCreated(user: User) {
  let invitedBy = 'N/A'
  let invite = await Invite.findOne({
    where: {
      redeemedBy: user.username
    },
    relations: ['creator']
  })
  if (invite) {
    invitedBy = invite.creator.username
  }
  let embed = new Discord.RichEmbed()
    .setTitle('User Created')
    .setColor('#37b24d')
    .setDescription('A user signed up on the Mirage instance')
    .setTimestamp()
    .addField('Username', user.username)
    .addField('Email', user.email)
    .addField('Invited By', invitedBy)
  await logChannel.send(embed)
}

export async function linkUser(user: User, newId: string) {
  if (user.discord !== null) {
    let discordUser = logChannel.guild.members.get(user.discord)
    if (!!discordUser) {
      discordUser.removeRole(process.env.DISCORD_MEMBER!)
      discordUser.send(
        `You linked a new Discord to your Mirage account.\n\nIf you did not do this, contact Mirage support!`
      )
    }
  }

  user.discord = newId
  await user.save()

  let discordUser = logChannel.guild.members.get(newId)
  if (!!discordUser) {
    discordUser.addRole(process.env.DISCORD_MEMBER!)
    discordUser.setNickname(user.username)
  }

  let embed = new Discord.RichEmbed()
    .setTitle('User Linked Discord')
    .setColor('#1098ad')
    .setDescription('A user linked their Discord to their account')
    .setTimestamp()
    .addField('Username', user.username)
    .addField('Discord', `<@${newId}>`)
    .addField('Discord ID', newId)
  await logChannel.send(embed)
}
export async function moderatorImageDelete(
  image: Image,
  deletor: User,
  ip: string
) {
  let embed = new Discord.RichEmbed()
    .setTitle('Image Deleted By Moderator')
    .setColor('#f03e3e')
    .setDescription(
      `Image \`${image.shortId}\` was deleted by a moderator\n[View on Moderator Dashboard](https://mirage.photos/moderator/images/${image.shortId})`
    )
    .setTimestamp()
    .addField('Deletion Type', image.deletionReason)
    .addField(
      'Uploader',
      `[${image.uploader.username}](https://mirage.photos/admin/users/${image.uploader.username})`
    )
  if (image.uploader.discord) {
    embed
      .addField('Discord', `<@${image.uploader.discord}>`)
      .addField('Discord ID', image.uploader.discord)
  }
  embed
    .addBlankField()
    .addField(
      'Moderator',
      `[${deletor.username}](https://mirage.photos/admin/users/${deletor.username})`
    )
    .addField('Moderator IP', ip)
  return logChannel.send(embed)
}
export async function userLogin(user: User, ip: string, userAgent: string) {
  if (user.discord === null) {
    return
  }

  let discordUser = logChannel.guild.members.get(user.discord)
  if (!discordUser) {
    return
  }

  let ua = useragent.parse(userAgent)

  let embed = new Discord.RichEmbed()
    .setTitle('User Login')
    .setColor('#f59f00')
    .setTimestamp()
    .setDescription('Your Mirage account was logged into')
    .setTimestamp()
    .addField('IP Address', ip)
    .addField('Browser', ua.toAgent())
    .addField('Device', ua.device.toString())
    .addField('OS', ua.os.toString())
  discordUser.send(embed)
}
export async function userSessionSteal(
  user: User,
  sessionIp: string,
  ip: string,
  userAgent: string
) {
  if (user.discord === null) {
    return
  }

  let discordUser = logChannel.guild.members.get(user.discord)
  if (!discordUser) {
    return
  }

  let ua = useragent.parse(userAgent)

  let embed = new Discord.RichEmbed()
    .setTitle('User Session IP Mismatch')
    .setColor('#f03e3e')
    .setTimestamp()
    .setDescription(
      `Your Mirage account has been logged into with an existing session with a new IP!\nThis could be due to:\n* Dynamic IPs\n* You connected to a VPN\n* Your session was stolen\n\nIf this was not you, contact a Mirage admin immediately.`
    )
    .setTimestamp()
    .addField('**your** IP address', sessionIp)
    .addField('Bad IP Address', ip)
    .addField('Browser', ua.toAgent())
    .addField('Device', ua.device.toString())
    .addField('OS', ua.os.toString())
  discordUser.send(embed)
}
