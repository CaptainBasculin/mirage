import { io } from '../index'
import { Image } from '../database/entities/Image'
import { User } from '../database/entities/User'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'

let imageCount = 0
let urlCount = 0
let userCount = 0

export async function initCounts() {
  imageCount = (await Image.find()).length
  urlCount = (await ShortenedUrl.find()).length
  userCount = (await User.find()).length
  io.on('connection', socket => {
    socket.emit('image', imageCount)
    socket.emit('url', urlCount)
    socket.emit('user', userCount)
  })
}
export function counts() {
  return { imageCount, urlCount, userCount }
}
export function increaseImage() {
  imageCount++
  io.emit('image', imageCount)
}
export function increaseUrl() {
  urlCount++
  io.emit('url', urlCount)
}
export function increaseUser() {
  userCount++
  io.emit('user', userCount)
}
