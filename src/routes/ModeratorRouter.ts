import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'

const ModeratorRouter = express.Router()
ModeratorRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).send('Unauthorized')
  }
  if (!req.user.moderator && !req.user.admin) {
    return res.status(401).send('Not an admin or moderator')
  }
  return next()
}
ModeratorRouter.use(authMiddleware)
ModeratorRouter.route('/').get((req, res) => {
  res.render('pages/moderator/index', {
    layout: 'layouts/moderator'
  })
})

ModeratorRouter.route('/image').get((req, res) => {
  res.render('pages/moderator/lookup', {
    layout: 'layouts/moderator'
  })
})

export default ModeratorRouter
