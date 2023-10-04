import { ClassPacket, Classroom, StudentCommInfo } from "../classroomObjects";
import { IClassroomChannel } from "./IClassroomChannel";
import { CommunicationManager } from "./communicationManager";

export class PeerToPeerChannel implements IClassroomChannel{
    emitClassActivation(_info: ClassPacket) {
        CommunicationManager.messageBus.emit('activate_class', _info)
    }
    emitClassDeactivation(_info: ClassPacket) {
        CommunicationManager.messageBus.emit('deactivate_class', _info)
    }
    emitClassStart(_info: ClassPacket) {
        CommunicationManager.messageBus.emit('start_class', _info)
    }
    emitClassEnd(_info: ClassPacket) {
        CommunicationManager.messageBus.emit('end_class', _info)
    }
    emitClassJoin(_info: StudentCommInfo) {
        CommunicationManager.messageBus.emit('join_class', _info)
    }
    emitClassExit(_info: StudentCommInfo) {
        CommunicationManager.messageBus.emit('exit_class', _info)
    }
    emitClassroomConfig(_info: Classroom) {
        CommunicationManager.messageBus.emit('share_classroom_config', _info)
    }
}