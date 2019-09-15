import Discord, { TextChannel } from 'discord.js'
import { User } from '../database/entities/User'
import { Invite } from '../database/entities/Invite'

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