import { classroomExampleComponent } from "../classroom/ui/ui";
import { seatingUIComponent } from "../seating/ui";

export const Render = () => (
  [
    seatingUIComponent,
    classroomExampleComponent()
    // Add extra UI here
  ]
)