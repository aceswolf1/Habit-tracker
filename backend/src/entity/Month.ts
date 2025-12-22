import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Week } from "./Week";

@Entity()
export class Month {
  @PrimaryGeneratedColumn("uuid")
  uuid!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  subtitle!: string;

  @Column({ default: 0 })
  progress!: number;

  @OneToMany(() => Week, (week) => week.month, { cascade: true })
  weeks!: Week[];
}
