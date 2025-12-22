import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Week } from "./Week";
import { Task } from "./Task";

@Entity()
export class Day {
  @PrimaryGeneratedColumn("uuid")
  uuid!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  subtitle!: string;

  @ManyToOne(() => Week, (week) => week.days)
  week!: Week;

  @OneToMany(() => Task, (task) => task.day, { cascade: true })
  tasks!: Task[];
}
