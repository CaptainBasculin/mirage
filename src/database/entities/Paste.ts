import { Entity, Column, BaseEntity, PrimaryColumn, ManyToOne } from 'typeorm'
import { User } from './User'

@Entity()
export class Paste extends BaseEntity {
  @PrimaryColumn()
  id: string

  @Column()
  shortId: string

  @ManyToOne(
    type => User,
    user => user.pastes
  )
  uploader: User

  @Column({
    default: false
  })
  encrypted: boolean

  @Column()
  content: string

  @Column()
  hash: string

  @Column()
  creationDate: Date

  @Column()
  size: number

  @Column({
    default: false
  })
  deleted: boolean

  @Column({
    default: 'N/A'
  })
  deletionReason: string

  userSerialize() {
    return {
      id: this.id,
      shortId: this.shortId,
      encrypted: this.encrypted,
      content: this.content,
      hash: this.hash,
      creationDate: this.creationDate,
      size: this.size,
      deleted: this.deleted,
      deletionReason: this.deletionReason
    }
  }
  serialize() {
    return {
      id: this.id,
      shortId: this.shortId,
      encrypted: this.encrypted,
      content: this.content,
      hash: this.hash,
      creationDate: this.creationDate,
      size: this.size,
      deleted: this.deleted,
      deletionReason: this.deletionReason,
      uploader: {
        id: this.uploader.id,
        username: this.uploader.username,
        email: this.uploader.email
      }
    }
  }
}
