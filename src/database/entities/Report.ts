import { Entity, Column, BaseEntity, PrimaryColumn, ManyToOne } from 'typeorm'
import { Image } from './Image'

@Entity()
export class Report extends BaseEntity {
  @PrimaryColumn()
  id: string

  @ManyToOne(
    type => Image,
    image => image.reports
  )
  image: Image

  @Column()
  reporterIp: string

  @Column({
    length: 256
  })
  reason: string

  @Column({
    default: false
  })
  resolved: boolean

  @Column()
  createdOn: Date

  serialize() {
    return {
      id: this.id,
      image: this.image.userSerialize(),
      reporterIp: this.reporterIp,
      reason: this.reason,
      resolved: this.resolved,
      createdOn: this.createdOn
    }
  }
}
