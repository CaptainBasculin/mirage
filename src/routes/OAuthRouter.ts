import express from 'express'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import { randomKey } from '../utils/RandomUtil'
import querystring from 'querystring'
import { linkUser } from '../bot'

const OAuthRouter = express.Router()
OAuthRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
OAuthRouter.use(bodyParser.json())

OAuthRouter.route('/discord/login').get((req, res) => {
  req.session!.discordState = randomKey()
  res.redirect(
    `https://discordapp.com/api/oauth2/authorize?client_id=${
      process.env.DISCORD_CLIENT
    }&redirect_uri=${
      process.env.BASE_URL
    }/oauth/discord/redirect&response_type=code&scope=identify%20guilds%20guilds.join&state=${
      req.session!.discordState
    }`
  )
})

OAuthRouter.route('/discord/redirect').get(async (req, res) => {
  let code = req.query.code
  let state = req.query.state
  if (!code || !state) {
    throw new Error('Discord login failed, code or state invalid')
  }
  if (state !== req.session!.discordState) {
    throw new Error('Discord login failed, state invalid!')
  }
  const tokenRes = await fetch('https://discordapp.com/api/v6/oauth2/token', {
    method: 'POST',
    body: querystring.stringify({
      client_id: process.env.DISCORD_CLIENT!,
      client_secret: process.env.DISCORD_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.BASE_URL}/oauth/discord/redirect`,
      scope: 'identify guilds guilds.join'
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    }
  })
  const tokenJson = await tokenRes.json()

  const userRes = await fetch('https://discordapp.com/api/v6/users/@me', {
    headers: {
      authorization: `${tokenJson.token_type} ${tokenJson.access_token}`
    }
  })
  const userJson = await userRes.json()
  const guildRes = await fetch(
    'https://discordapp.com/api/v6/users/@me/guilds',
    {
      headers: {
        authorization: `${tokenJson.token_type} ${tokenJson.access_token}`
      }
    }
  )
  let roles = [process.env.DISCORD_MEMBER!]
  if (req.user.moderator) {
    roles.push(process.env.DISCORD_MODERATOR!)
  }
  if (req.user.alpha) {
    roles.push(process.env.DISCORD_ALPHA!)
  }
  if (req.user.beta) {
    roles.push(process.env.DISCORD_BETA!)
  }
  if (req.user.contributor) {
    roles.push(process.env.DISCORD_CONTRIBUTOR!)
  }
  if (req.user.domainDonor) {
    roles.push(process.env.DISCORD_DONOR!)
  }
  if (req.user.trusted) {
    roles.push(process.env.DISCORD_TRUSTED!)
  }

  const guildJson = await guildRes.json()
  if (
    !guildJson.find((guild: any) => guild.id === process.env.DISCORD_SERVER)
  ) {
    await fetch(
      `https://discordapp.com/api/v6/guilds/${process.env
        .DISCORD_SERVER!}/members/${userJson.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          access_token: tokenJson.access_token,
          nick: req.user.username,
          roles
        }),
        headers: {
          'content-type': 'application/json',
          authorization: `Bot ${process.env.DISCORD_TOKEN!}`
        }
      }
    )
  }
  await linkUser(req.user, userJson.id, roles)
  req.flash(
    'is-success',
    `Sucessfully linked discord ${userJson.username}#${userJson.discriminator} to your account`
  )
  return res.redirect(`/account/discord`)
})

export default OAuthRouter
