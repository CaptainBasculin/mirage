import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Image } from '../database/entities/Image'
import { User } from '../database/entities/User'

const AnalyticsRouter = express.Router()
AnalyticsRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).send('Unauthorized')
  }
  if (!req.user.admin) {
    return res.status(401).send('Not an admin')
  }
  return next()
}
AnalyticsRouter.use(authMiddleware)

AnalyticsRouter.route('/').get(async (req, res) => {
  let users = await User.find()
  let images = await Image.find({
    relations: ['uploader']
  })
  let usersSerialized = users.map(user => user.serialize())
  let imagesSerialized = images.map(image => image.serialize())
  let usersJSON = JSON.stringify(usersSerialized).replace(/'/g, "\\'")
  let imagesJSON = JSON.stringify(imagesSerialized).replace(/'/g, "\\'")
  res.render('pages/analytics/index', {
    layout: 'layouts/analytics',
    users,
    images,
    usersSerialized,
    imagesSerialized,
    usersJSON,
    imagesJSON
  })
})
AnalyticsRouter.route('/test').get(async (req, res) => {
  return res.render('pages/analytics/test', {
    layout: 'layouts/analytics'
  })
})
export default AnalyticsRouter
