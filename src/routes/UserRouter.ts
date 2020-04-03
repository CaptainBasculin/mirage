import express, { Request, Response } from 'express'
import { User } from '../database/entities/User'
import { Domain } from '../database/entities/Domain'
import { Invite } from '../database/entities/Invite'

const UserRouter = express.Router()

UserRouter.route('/:user').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.user
    },
    relations: ['donatedDomains']
  })
  if (!user) {
    return res.render('pages/user/notfound')
  }
  const sortFn = (a: Domain, b: Domain) => {
    if (a.domain < b.domain) {
      return -1
    }
    if (a.domain > b.domain) {
      return 1
    }
    return 0
  }
  if (user.donatedDomains) {
    user.donatedDomains = user.donatedDomains.sort(sortFn)
  }

  let invite = await Invite.findOne({
    where: {
      redeemedBy: user.username
    },
    relations: ['creator']
  })
  let notInvited = !invite
  return res.render('pages/user/user', {
    user,
    notInvited,
    invite
  })
})

export default UserRouter
