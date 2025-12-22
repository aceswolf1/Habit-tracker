import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Day } from "./Day";

@Entity()
export class Task {
  @PrimaryGeneratedColumn("uuid")
  uuid!: string;

  @Column()
  description!: string;

  @Column({ default: false })
  optional!: boolean;

  @Column({ default: false })
  completed!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column({ default: "" })
  recurrenceId!: string;

  @ManyToOne(() => Day, (day) => day.tasks)
  day!: Day;
}
