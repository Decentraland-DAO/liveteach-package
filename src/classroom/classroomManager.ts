// @ts-nocheck
import { ClassController } from "./classroomControllers/classController";
import { ClassControllerFactory } from "./factories/classControllerFactory";
import { SmartContractManager } from "./smartContractManager";
import { CommunicationManager } from "./comms/communicationManager";
import { Classroom, ClassContent } from "./types/classroomTypes";
import { ClassroomFactory } from "./factories/classroomFactory";
import { UserDataHelper } from "./userDataHelper";
import { UserType } from "../enums";
import { IClassroomChannel } from "./comms/IClassroomChannel";
import { Entity, Transform, engine } from "@dcl/sdk/ecs";
import { Quaternion, Vector3 } from "@dcl/sdk/math";
import { ImageContentConfig, ScreenManager, VideoContentConfig, ModelContentConfig, VideoContent } from "../classroomContent";
import { ContentUnitManager } from "../contentUnits/contentUnitManager";
import { IContentUnit } from "../contentUnits/IContentUnit"
import * as utils from '@dcl-sdk/utils'

export abstract class ClassroomManager {
    static screenManager: ScreenManager
    static classController: ClassController
    static activeClassroom: Classroom = null
    static activeContent: ClassContent = null
    static requestingJoinClass: boolean = false
    static classroomConfig: any
    static originEntity: Entity
    static testMode: boolean = false

    static Initialise(_classroomConfig: any, _channel: IClassroomChannel, _testMode: boolean = false): void {
        ClassroomManager.classroomConfig = _classroomConfig
        ClassroomManager.testMode = _testMode

        SmartContractManager.Initialise()
        CommunicationManager.Initialise(_channel)
        ClassroomManager.screenManager = new ScreenManager()

        ClassroomManager.originEntity = engine.addEntity()
        Transform.create(ClassroomManager.originEntity, {
            position: ClassroomManager.classroomConfig.classroom.origin
        })
    }

    static AddScreen(_position: Vector3, _rotation: Quaternion, _scale: Vector3, _parent?: Entity) {
        ClassroomManager.screenManager.addScreen(_position, _rotation, _scale, _parent)
    }

    static SetClassController(type: UserType): void {
        if (ClassroomManager.classController && ClassroomManager.classController.isTeacher() && type === UserType.teacher) return
        if (ClassroomManager.classController && ClassroomManager.classController.isStudent() && type === UserType.student) return

        if (ClassroomManager.classController && ClassroomManager.classController.isTeacher() && type === UserType.student) {
            ClassroomManager.DeactivateClassroom()
        }

        if (ClassroomManager.classController && ClassroomManager.classController.isStudent() && type === UserType.teacher) {
            ClassroomManager.classController.exitClass()
        }

        ClassroomManager.classController = ClassControllerFactory.Create(type)
    }

    static async SetTeacherClassContent(_id: string): Promise<void> {
        SmartContractManager.FetchClassContent(_id)
            .then(function (classContent) {
                ClassroomManager.activeContent = classContent
                ClassroomManager.activeClassroom = ClassroomFactory.CreateTeacherClassroom(JSON.stringify(ClassroomManager.classroomConfig.classroom), ClassroomManager.activeContent.name, ClassroomManager.activeContent.description)

                ClassroomManager.screenManager.loadContent()

                CommunicationManager.EmitClassActivation({
                    id: ClassroomManager.activeClassroom.guid, //use the class guid for students instead of the active content id
                    name: ClassroomManager.activeContent.name,
                    description: ClassroomManager.activeContent.description
                })
            })
    }

    static async DeactivateClassroom(): Promise<void> {
        return SmartContractManager.DectivateClassroom()
            .then(function () {
                if (ClassroomManager.activeContent) {
                    CommunicationManager.EmitClassDeactivation({
                        id: ClassroomManager.activeClassroom.guid, //use the class guid for students instead of the active content id
                        name: ClassroomManager.activeContent.name,
                        description: ClassroomManager.activeContent.description
                    })
                    ClassroomManager.activeClassroom = null
                }
            })
    }

    static async StartClass(): Promise<void> {
        return SmartContractManager.StartClass()
            .then(function () {
                CommunicationManager.EmitClassStart({
                    id: ClassroomManager.activeClassroom.guid, //use the class guid for students instead of the active content id
                    name: ClassroomManager.activeContent.name,
                    description: ClassroomManager.activeContent.description
                })
            })
    }

    static async EndClass(): Promise<void> {
        return SmartContractManager.EndClass()
            .then(function () {
                CommunicationManager.EmitClassEnd({
                    id: ClassroomManager.activeClassroom.guid, //use the class guid for students instead of the active content id
                    name: ClassroomManager.activeContent.name,
                    description: ClassroomManager.activeContent.description
                })
            })
    }

    static JoinClass(_guid: string): void {
        ClassroomManager.requestingJoinClass = true

        CommunicationManager.EmitClassJoin({
            id: ClassroomManager.classController.classList[ClassroomManager.classController.selectedClassIndex].id,
            name: ClassroomManager.classController.classList[ClassroomManager.classController.selectedClassIndex].name,
            description: ClassroomManager.classController.classList[ClassroomManager.classController.selectedClassIndex].description,
            studentID: UserDataHelper.GetUserId(),
            studentName: UserDataHelper.GetDisplayName()
        })
    }

    static ExitClass(): void {
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitClassExit({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                studentID: UserDataHelper.GetUserId(),
                studentName: UserDataHelper.GetDisplayName()
            })
            ClassroomManager.activeClassroom = null
        }
    }

    static DisplayImage(_image: ImageContentConfig): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedImage = _image
        ClassroomManager.activeClassroom.displayedVideo = null
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitImageDisplay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                image: _image
            })
        }
    }

    static PlayVideo(_video: VideoContentConfig): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedImage = null
        ClassroomManager.activeClassroom.displayedVideo = _video
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitVideoPlay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                video: {
                    src: _video.src,
                    caption: _video.caption,
                    playing: true,
                    position: _video.position,
                    volume: _video.volume ?? 1,
                    ratio: _video.ratio
                }
            })
        }
    }

    static PauseVideo(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedVideo.playing = false
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitVideoPause({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static ResumeVideo(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedVideo.playing = true
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitVideoResume({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static SetVideoVolume(_volume: number): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedVideo.volume = _volume
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitVideoVolume({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                volume: _volume
            })
        }
    }

    static PlayModel(_model: ModelContentConfig): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedModel = _model
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitModelPlay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                model: _model
            })
        }
    }

    static PauseModel(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitModelPause({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static ResumeModel(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitModelResume({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static DeactivateScreens(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitScreenDeactivation({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static DeactivateModels(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ClassroomManager.activeClassroom.displayedModel = null
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitModelDeactivation({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static RegisterContentUnit(_key: string, _unit: IContentUnit): void {
        ContentUnitManager.register(_key, _unit)
    }

    static StartContentUnit(_key: string, _data: any): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ContentUnitManager.start(_key, _data)
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitContentUnitStart({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                unit: {
                    key: _key,
                    data: _data
                }
            })
        }
    }

    static EndContentUnit(): void {
        if (!ClassroomManager.classController?.isTeacher()) return

        ContentUnitManager.end()
        if (ClassroomManager.activeClassroom) {
            CommunicationManager.EmitContentUnitEnd({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription
            })
        }
    }

    static SendContentUnitData(_data: any): void {
        if (!ClassroomManager.activeClassroom) return

        if (ClassroomManager.classController?.isTeacher()) {
            CommunicationManager.EmitContentUnitTeacherSend({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                data: _data
            })
        }
        else {
            CommunicationManager.EmitContentUnitStudentSend({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                studentID: UserDataHelper.GetUserId(),
                studentName: UserDataHelper.GetDisplayName(),
                data: _data
            })
        }
    }

    static UpdateClassroom(): void {
        // video
        if (ClassroomManager.screenManager.videoContent && ClassroomManager.screenManager.videoContent.content.length > 0 && ClassroomManager.activeClassroom.displayedVideo) {
            const content = ClassroomManager.screenManager.videoContent.getContent() as VideoContent
            ClassroomManager.activeClassroom.displayedVideo.position = content.offset + VideoContent.SYNC_OFFSET
            ClassroomManager.activeClassroom.displayedVideo.playing = content.isPaused ? false : true
            ClassroomManager.activeClassroom.displayedVideo.volume = ClassroomManager.screenManager.muted ? 0 : 1
        }
        // model
    }

    static SyncClassroom(): void {
        // sync seating
        if (ClassroomManager.activeClassroom.seatingEnabled) {

        }

        // sync image
        if (ClassroomManager.activeClassroom.displayedImage) {
            CommunicationManager.OnImageDisplay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                image: ClassroomManager.activeClassroom.displayedImage
            })
        }

        // sync video
        if (ClassroomManager.activeClassroom.displayedVideo) {
            CommunicationManager.OnVideoPlay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                video: ClassroomManager.activeClassroom.displayedVideo
            })
            if (!ClassroomManager.activeClassroom.displayedVideo.playing) {
                utils.timers.setTimeout(() => {
                    CommunicationManager.OnVideoPause({
                        id: ClassroomManager.activeClassroom.guid,
                        name: ClassroomManager.activeClassroom.className,
                        description: ClassroomManager.activeClassroom.classDescription
                    })
                }, 1000)
            }
            CommunicationManager.OnVideoVolume({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                volume: ClassroomManager.activeClassroom.displayedVideo.volume ?? 1
            })
        }

        // sync model
        if (ClassroomManager.activeClassroom.displayedModel) {
            CommunicationManager.OnModelPlay({
                id: ClassroomManager.activeClassroom.guid,
                name: ClassroomManager.activeClassroom.className,
                description: ClassroomManager.activeClassroom.classDescription,
                model: ClassroomManager.activeClassroom.displayedModel
            })
        }
    }
}