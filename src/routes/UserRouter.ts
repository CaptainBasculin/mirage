import express, { Request, Response } from 'express'
import { User } from '../database/entities/User'

const UserRouter = express.Router()

UserRouter.route('/:user').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.user
    }
  })
  if (!user) {
    return res.render('pages/user/notfound')
  }

  return res.render('pages/user/user', {
    user
  })
})

export default UserRouter
