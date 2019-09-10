import { Entity, Column, BaseEntity, PrimaryColumn, ManyToOne } from 'typeorm'
import { User } from './User'

@Entity()
export class ShortenedUrl extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  shortId: string

  @ManyToOne(type => User, user => user.urls)
  creator: User

  @Column()
  host: string

  @Column()
  creationDate: Date

  @Column()
  url: string

  @Column({
    default: false
  })
  deleted: boolean

  userSerialize() {
    return {
      id: this.id,
      shortId: this.shortId,
      host: this.host,
      creationDate: this.creationDate,
      url: this.url,
      deleted: this.deleted,
      creator: {
        id: this.creator.id,
        username: this.creator.username,
        email: this.creator.email
      }
    }
  }
  serialize() {
    return {
      id: this.id,
      shortId: this.shortId,
      host: this.host,
      creationDate: this.creationDate,
      url: this.url,
      deleted: this.deleted,
      creator: {
        id: this.creator.id,
        username: this.creator.username,
        email: this.creator.email
      }
    }
  }
}
