const capabilities = require("./capabilities");

const DreameValetudoRobot = require("./DreameValetudoRobot");
const entities = require("../../entities");
const Logger = require("../../Logger");
const MopAttachmentReminderValetudoEvent = require("../../valetudo_events/events/MopAttachmentReminderValetudoEvent");
const Tools = require("../../Tools");
const ValetudoRestrictedZone = require("../../entities/core/ValetudoRestrictedZone");
const ValetudoSelectionPreset = require("../../entities/core/ValetudoSelectionPreset");

const stateAttrs = entities.state.attributes;

//This is taken from the D9 and Z10 Pro MIOT spec but it applies to many more
//https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:vacuum:0000A006:dreame-p2009:1
const MIOT_SERVICES = Object.freeze({
    DEVICE: {
        SIID: 1,
        PROPERTIES: {
            SERIAL_NUMBER: {
                PIID: 5
            }
        }
    },
    VACUUM_1: {
        SIID: 2,
        PROPERTIES: {
            STATUS: {
                PIID: 1
            },
            ERROR: {
                PIID: 2
            }
        },
        ACTIONS: {
            RESUME: {
                AIID: 1
            },
            PAUSE: {
                AIID: 2
            }
        }
    },
    VACUUM_2: {
        SIID: 4,
        PROPERTIES: {
            MODE: {
                PIID: 1
            },
            CLEANING_TIME: {
                PIID: 2
            },
            CLEANING_AREA: {
                PIID: 3
            },
            FAN_SPEED: {
                PIID: 4
            },
            WATER_USAGE: {
                PIID: 5
            },
            WATER_TANK_ATTACHMENT: {
                PIID: 6
            },
            TASK_STATUS: {
                PIID: 7
            },
            STATE_CHANGE_TIMESTAMP: {
                PIID: 8 //Value is a unix timestamp
            },
            UNKNOWN_01: { //likely irrelevant
                PIID: 9
            },
            ADDITIONAL_CLEANUP_PROPERTIES: {
                PIID: 10
            },
            CARPET_MODE: {
                PIID: 12
            },
            MANUAL_CONTROL: {
                PIID: 15
            },
            ERROR_CODE: {
                PIID: 18
            },
            LOCATING_STATUS: {
                PIID: 20
                /*
                    Observed values:
                    0 - knows where it is in its map
                    1 - Trys to locate itself in its map
                    10 - fails to locate itself in its map
                    11 - successfully located itself in its map
                 */
            },
            OBSTACLE_AVOIDANCE: {
                PIID: 21
            },
            KEY_LOCK: {
                PIID: 27
            }
        },
        ACTIONS: {
            START: {
                AIID: 1
            },
            STOP: {
                AIID: 2
            }
        }
    },
    BATTERY: {
        SIID: 3,
        PROPERTIES: {
            LEVEL: {
                PIID: 1
            },
            CHARGING: {
                PIID: 2
            }
        },
        ACTIONS: {
            START_CHARGE: {
                AIID: 1
            }
        }
    },
    DND: {
        SIID: 5,
        PROPERTIES: {
            ENABLED: {
                PIID: 1
            },
            START_TIME: {
                PIID: 2
            },
            END_TIME: {
                PIID: 3
            }
        }
    },
    AUDIO: {
        SIID: 7,
        PROPERTIES: {
            VOLUME: {
                PIID: 1
            },
            ACTIVE_VOICEPACK: {
                PIID: 2
            },
            VOICEPACK_INSTALL_STATUS: {
                PIID: 3
            },
            INSTALL_VOICEPACK: {
                PIID: 4
            }
        },
        ACTIONS: {
            LOCATE: {
                AIID: 1
            },
            VOLUME_TEST: {
                AIID: 2
            }
        }
    },
    MAIN_BRUSH: {
        SIID: 9,
        PROPERTIES: {
            TIME_LEFT: { //Hours
                PIID: 1
            },
            PERCENT_LEFT: {
                PIID: 2
            }
        },
        ACTIONS: {
            RESET: {
                AIID: 1
            }
        }
    },
    SIDE_BRUSH: {
        SIID: 10,
        PROPERTIES: {
            TIME_LEFT: { //Hours
                PIID: 1
            },
            PERCENT_LEFT: {
                PIID: 2
            }
        },
        ACTIONS: {
            RESET: {
                AIID: 1
            }
        }
    },
    FILTER: {
        SIID: 11,
        PROPERTIES: {
            TIME_LEFT: { //Hours
                PIID: 2
            },
            PERCENT_LEFT: {
                PIID: 1 //It's only swapped for the filter for some reason..
            }
        },
        ACTIONS: {
            RESET: {
                AIID: 1
            }
        }
    },
    SENSOR: {
        SIID: 16,
        PROPERTIES: {
            TIME_LEFT: { //Hours
                PIID: 2
            },
            PERCENT_LEFT: {
                PIID: 1
            }
        },
        ACTIONS: {
            RESET: {
                AIID: 1
            }
        }
    },
    MAP: {
        SIID: 6,
        PROPERTIES: {
            MAP_DATA: {
                PIID: 1
            },
            FRAME_TYPE: { //Can be char I or P (numbers)
                PIID: 2
            },
            CLOUD_FILE_NAME: {
                PIID: 3
            },
            MAP_DETAILS: {
                PIID: 4
            },

            ACTION_RESULT: {
                PIID: 6
            },

            CLOUD_FILE_NAME_2: {
                PIID: 8 //irrelevant for us
            }
        },
        ACTIONS: {
            POLL: {
                AIID: 1
            },
            EDIT: {
                AIID: 2
            }
        }
    },
    PERSISTENT_MAPS: {
        SIID: 13,
        PROPERTIES: {
            ENABLED: {
                PIID: 1
            }
        }
    },
    AUTO_EMPTY_DOCK: {
        SIID: 15,
        PROPERTIES: {
            AUTO_EMPTY_ENABLED: {
                PIID: 1
            },
            INTERVAL: {
                PIID: 2
            },
            STATUS: {
                PIID: 3 //Whether or not it's currently able to execute the empty action?
            },
            ACTION_STATUS: {
                PIID: 5 //1 = currently cleaning, 0 = not currently cleaning
            }
        },
        ACTIONS: {
            EMPTY_DUSTBIN: {
                AIID: 1
            }
        }
    }
});



class DreameGen2ValetudoRobot extends DreameValetudoRobot {
    /**
     *
     * @param {object} options
     * @param {import("../../Configuration")} options.config
     * @param {import("../../ValetudoEventStore")} options.valetudoEventStore
     */
    constructor(options) {
        super(
            Object.assign(
                {},
                options,
                {
                    miotServices: {
                        MAP: MIOT_SERVICES.MAP
                    }
                }
            )
        );

        this.lastMapPoll = new Date(0);

        this.mode = 0; //Idle
        this.isCharging = false;
        this.errorCode = "0";
        this.stateNeedsUpdate = false;

        this.registerCapability(new capabilities.DreameBasicControlCapability({
            robot: this,
            miot_actions: {
                start: {
                    siid: MIOT_SERVICES.VACUUM_1.SIID,
                    aiid: MIOT_SERVICES.VACUUM_1.ACTIONS.RESUME.AIID
                },
                stop: {
                    siid: MIOT_SERVICES.VACUUM_2.SIID,
                    aiid: MIOT_SERVICES.VACUUM_2.ACTIONS.STOP.AIID
                },
                pause: {
                    siid: MIOT_SERVICES.VACUUM_1.SIID,
                    aiid: MIOT_SERVICES.VACUUM_1.ACTIONS.PAUSE.AIID
                },
                home: {
                    siid: MIOT_SERVICES.BATTERY.SIID,
                    aiid: MIOT_SERVICES.BATTERY.ACTIONS.START_CHARGE.AIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameFanSpeedControlCapability({
            robot: this,
            presets: Object.keys(DreameValetudoRobot.FAN_SPEEDS).map(k => {
                return new ValetudoSelectionPreset({name: k, value: DreameValetudoRobot.FAN_SPEEDS[k]});
            }),
            siid: MIOT_SERVICES.VACUUM_2.SIID,
            piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.FAN_SPEED.PIID
        }));

        this.registerCapability(new capabilities.DreameWaterUsageControlCapability({
            robot: this,
            presets: Object.keys(DreameValetudoRobot.WATER_GRADES).map(k => {
                return new ValetudoSelectionPreset({name: k, value: DreameValetudoRobot.WATER_GRADES[k]});
            }),
            siid: MIOT_SERVICES.VACUUM_2.SIID,
            piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.WATER_USAGE.PIID
        }));

        this.registerCapability(new capabilities.DreameLocateCapability({
            robot: this,
            siid: MIOT_SERVICES.AUDIO.SIID,
            aiid: MIOT_SERVICES.AUDIO.ACTIONS.LOCATE.AIID
        }));

        this.registerCapability(new capabilities.DreameZoneCleaningCapability({
            robot: this,
            miot_actions: {
                start: {
                    siid: MIOT_SERVICES.VACUUM_2.SIID,
                    aiid: MIOT_SERVICES.VACUUM_2.ACTIONS.START.AIID
                }
            },
            miot_properties: {
                mode: {
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.MODE.PIID
                },
                additionalCleanupParameters: {
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.ADDITIONAL_CLEANUP_PROPERTIES.PIID
                }
            },
            zoneCleaningModeId: 19
        }));

        this.registerCapability(new capabilities.DreameMapSegmentationCapability({
            robot: this,
            miot_actions: {
                start: {
                    siid: MIOT_SERVICES.VACUUM_2.SIID,
                    aiid: MIOT_SERVICES.VACUUM_2.ACTIONS.START.AIID
                }
            },
            miot_properties: {
                mode: {
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.MODE.PIID
                },
                additionalCleanupParameters: {
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.ADDITIONAL_CLEANUP_PROPERTIES.PIID
                }
            },
            segmentCleaningModeId: 18
        }));

        this.registerCapability(new capabilities.DreameMapSegmentEditCapability({
            robot: this,
            miot_actions: {
                map_edit: {
                    siid: MIOT_SERVICES.MAP.SIID,
                    aiid: MIOT_SERVICES.MAP.ACTIONS.EDIT.AIID
                }
            },
            miot_properties: {
                mapDetails: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.MAP_DETAILS.PIID
                },
                actionResult: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.ACTION_RESULT.PIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameMapSegmentRenameCapability({
            robot: this,
            miot_actions: {
                map_edit: {
                    siid: MIOT_SERVICES.MAP.SIID,
                    aiid: MIOT_SERVICES.MAP.ACTIONS.EDIT.AIID
                }
            },
            miot_properties: {
                mapDetails: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.MAP_DETAILS.PIID
                },
                actionResult: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.ACTION_RESULT.PIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameMapResetCapability({
            robot: this,
            miot_actions: {
                map_edit: {
                    siid: MIOT_SERVICES.MAP.SIID,
                    aiid: MIOT_SERVICES.MAP.ACTIONS.EDIT.AIID
                }
            },
            miot_properties: {
                mapDetails: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.MAP_DETAILS.PIID
                },
                actionResult: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.ACTION_RESULT.PIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameCombinedVirtualRestrictionsCapability({
            robot: this,
            supportedRestrictedZoneTypes: [
                ValetudoRestrictedZone.TYPE.REGULAR,
                ValetudoRestrictedZone.TYPE.MOP
            ],
            miot_actions: {
                map_edit: {
                    siid: MIOT_SERVICES.MAP.SIID,
                    aiid: MIOT_SERVICES.MAP.ACTIONS.EDIT.AIID
                }
            },
            miot_properties: {
                mapDetails: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.MAP_DETAILS.PIID
                },
                actionResult: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.ACTION_RESULT.PIID
                }
            }
        }));

        this.consumableMonitoringCapability = new capabilities.DreameConsumableMonitoringCapability({
            robot: this,
            miot_properties: {
                main_brush: {
                    siid: MIOT_SERVICES.MAIN_BRUSH.SIID,
                    piid: MIOT_SERVICES.MAIN_BRUSH.PROPERTIES.TIME_LEFT.PIID
                },
                side_brush: {
                    siid: MIOT_SERVICES.SIDE_BRUSH.SIID,
                    piid: MIOT_SERVICES.SIDE_BRUSH.PROPERTIES.TIME_LEFT.PIID
                },
                filter: {
                    siid: MIOT_SERVICES.FILTER.SIID,
                    piid: MIOT_SERVICES.FILTER.PROPERTIES.TIME_LEFT.PIID
                },
                sensor: {
                    siid: MIOT_SERVICES.SENSOR.SIID,
                    piid: MIOT_SERVICES.SENSOR.PROPERTIES.TIME_LEFT.PIID
                }
            },
            miot_actions: {
                reset_main_brush: {
                    siid: MIOT_SERVICES.MAIN_BRUSH.SIID,
                    aiid: MIOT_SERVICES.MAIN_BRUSH.ACTIONS.RESET.AIID
                },
                reset_side_brush: {
                    siid: MIOT_SERVICES.SIDE_BRUSH.SIID,
                    aiid: MIOT_SERVICES.SIDE_BRUSH.ACTIONS.RESET.AIID
                },
                reset_filter: {
                    siid: MIOT_SERVICES.FILTER.SIID,
                    aiid: MIOT_SERVICES.FILTER.ACTIONS.RESET.AIID
                },
                reset_sensor: {
                    siid: MIOT_SERVICES.SENSOR.SIID,
                    aiid: MIOT_SERVICES.SENSOR.ACTIONS.RESET.AIID
                }
            }
        });
        this.registerCapability(this.consumableMonitoringCapability);

        this.registerCapability(new capabilities.DreameSpeakerVolumeControlCapability({
            robot: this,
            siid: MIOT_SERVICES.AUDIO.SIID,
            piid: MIOT_SERVICES.AUDIO.PROPERTIES.VOLUME.PIID
        }));
        this.registerCapability(new capabilities.DreameSpeakerTestCapability({
            robot: this,
            siid: MIOT_SERVICES.AUDIO.SIID,
            aiid: MIOT_SERVICES.AUDIO.ACTIONS.VOLUME_TEST.AIID
        }));

        this.registerCapability(new capabilities.DreameVoicePackManagementCapability({
            robot: this,
            siid: MIOT_SERVICES.AUDIO.SIID,
            active_voicepack_piid: MIOT_SERVICES.AUDIO.PROPERTIES.ACTIVE_VOICEPACK.PIID,
            voicepack_install_status_piid: MIOT_SERVICES.AUDIO.PROPERTIES.VOICEPACK_INSTALL_STATUS.PIID,
            install_voicepack_piid: MIOT_SERVICES.AUDIO.PROPERTIES.INSTALL_VOICEPACK.PIID
        }));

        this.registerCapability(new capabilities.DreameCarpetModeControlCapability({
            robot: this,
            siid: MIOT_SERVICES.VACUUM_2.SIID,
            piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.CARPET_MODE.PIID
        }));

        this.registerCapability(new capabilities.DreamePendingMapChangeHandlingCapability({
            robot: this,
            miot_actions: {
                map_edit: {
                    siid: MIOT_SERVICES.MAP.SIID,
                    aiid: MIOT_SERVICES.MAP.ACTIONS.EDIT.AIID
                }
            },
            miot_properties: {
                mapDetails: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.MAP_DETAILS.PIID
                },
                actionResult: {
                    piid: MIOT_SERVICES.MAP.PROPERTIES.ACTION_RESULT.PIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameMappingPassCapability({
            robot: this,
            miot_actions: {
                start: {
                    siid: MIOT_SERVICES.VACUUM_2.SIID,
                    aiid: MIOT_SERVICES.VACUUM_2.ACTIONS.START.AIID
                }
            },
            miot_properties: {
                mode: {
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.MODE.PIID
                }
            },
            mappingModeId: 21
        }));

        this.registerCapability(new capabilities.DreameManualControlCapability({
            robot: this,
            miot_properties: {
                manual_control: {
                    siid: MIOT_SERVICES.VACUUM_2.SIID,
                    piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.MANUAL_CONTROL.PIID
                }
            }
        }));

        this.registerCapability(new capabilities.DreameKeyLockCapability({
            robot: this,
            siid: MIOT_SERVICES.VACUUM_2.SIID,
            piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.KEY_LOCK.PIID
        }));

        this.registerCapability(new capabilities.DreameDoNotDisturbCapability({
            robot: this,
            miot_properties: {
                dnd_enabled: {
                    siid: MIOT_SERVICES.DND.SIID,
                    piid: MIOT_SERVICES.DND.PROPERTIES.ENABLED.PIID
                },
                dnd_start_time: {
                    siid: MIOT_SERVICES.DND.SIID,
                    piid: MIOT_SERVICES.DND.PROPERTIES.START_TIME.PIID
                },
                dnd_end_time: {
                    siid: MIOT_SERVICES.DND.SIID,
                    piid: MIOT_SERVICES.DND.PROPERTIES.END_TIME.PIID
                }
            }
        }));

        this.state.upsertFirstMatchingAttribute(new entities.state.attributes.AttachmentStateAttribute({
            type: entities.state.attributes.AttachmentStateAttribute.TYPE.WATERTANK,
            attached: false
        }));

        this.state.upsertFirstMatchingAttribute(new entities.state.attributes.AttachmentStateAttribute({
            type: entities.state.attributes.AttachmentStateAttribute.TYPE.MOP,
            attached: false
        }));
    }

    onMessage(msg) {
        if (super.onMessage(msg) === true) {
            return true;
        }

        switch (msg.method) {
            case "properties_changed": {
                msg.params.forEach(e => {
                    switch (e.siid) {
                        case MIOT_SERVICES.MAP.SIID:
                            switch (e.piid) {
                                case MIOT_SERVICES.MAP.PROPERTIES.MAP_DATA.PIID:
                                    //intentional since these will only be P-Frames which are unsupported (yet?)
                                    break;
                                case MIOT_SERVICES.MAP.PROPERTIES.CLOUD_FILE_NAME.PIID:
                                case MIOT_SERVICES.MAP.PROPERTIES.CLOUD_FILE_NAME_2.PIID:
                                    //intentionally left blank since we don't care about this
                                    break;
                                default:
                                    Logger.warn("Unhandled Map property change ", e);
                            }
                            break;
                        case MIOT_SERVICES.VACUUM_1.SIID:
                        case MIOT_SERVICES.VACUUM_2.SIID:
                        case MIOT_SERVICES.BATTERY.SIID:
                        case MIOT_SERVICES.MAIN_BRUSH.SIID:
                        case MIOT_SERVICES.SIDE_BRUSH.SIID:
                        case MIOT_SERVICES.FILTER.SIID:
                        case MIOT_SERVICES.SENSOR.SIID:
                            this.parseAndUpdateState([e]);
                            break;
                        case MIOT_SERVICES.DEVICE.SIID:
                        case 99: //This seems to be a duplicate of the device service
                            //Intentionally ignored
                            break;
                        case MIOT_SERVICES.AUDIO.SIID:
                            //Intentionally ignored since we only poll that info when required and therefore don't care about updates
                            break;
                        case MIOT_SERVICES.AUTO_EMPTY_DOCK.SIID:
                            //Intentionally left blank (for now?)
                            break;
                        default:
                            Logger.warn("Unhandled property change ", e);
                    }
                });

                this.sendCloud({id: msg.id, "result":"ok"});
                return true;
            }
            case "props":
                if (msg.params && msg.params.ota_state) {
                    this.sendCloud({id: msg.id, "result":"ok"});
                    return true;
                }
                break;
            case "event_occured": {
                // This is sent by the robot after a cleanup has finished.
                // It will contain the parameters of that past cleanup
                // Therefore, we ignore it in our current status

                this.sendCloud({id: msg.id, "result":"ok"});
                return true;
            }
        }

        return false;
    }

    async pollState() {
        const response = await this.sendCommand("get_properties", [
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.MODE.PIID
            },
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.TASK_STATUS.PIID
            },
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.FAN_SPEED.PIID
            },
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.WATER_USAGE.PIID
            },
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.WATER_TANK_ATTACHMENT.PIID
            },
            {
                siid: MIOT_SERVICES.VACUUM_2.SIID,
                piid: MIOT_SERVICES.VACUUM_2.PROPERTIES.ERROR_CODE.PIID
            },
            {
                siid: MIOT_SERVICES.BATTERY.SIID,
                piid: MIOT_SERVICES.BATTERY.PROPERTIES.LEVEL.PIID
            },
            {
                siid: MIOT_SERVICES.BATTERY.SIID,
                piid: MIOT_SERVICES.BATTERY.PROPERTIES.CHARGING.PIID
            }
        ].map(e => {
            e.did = this.deviceId;

            return e;
        }));

        if (response) {
            this.parseAndUpdateState(response);
        }

        return this.state;
    }


    parseAndUpdateState(data) {
        if (!Array.isArray(data)) {
            Logger.error("Received non-array state", data);
            return;
        }

        data.forEach(elem => {
            switch (elem.siid) {
                case MIOT_SERVICES.VACUUM_1.SIID: {
                    //intentionally left blank since there's nothing here that isn't also in VACUUM_2
                    break;
                }

                case MIOT_SERVICES.VACUUM_2.SIID: {
                    switch (elem.piid) {
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.MODE.PIID: {
                            this.mode = elem.value;

                            this.stateNeedsUpdate = true;
                            break;
                        }
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.ERROR_CODE.PIID: {
                            this.errorCode = elem.value;

                            this.stateNeedsUpdate = true;
                            break;
                        }
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.TASK_STATUS.PIID: {
                            this.taskStatus = elem.value;

                            this.stateNeedsUpdate = true;
                            break;
                        }
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.FAN_SPEED.PIID: {
                            let matchingFanSpeed = Object.keys(DreameValetudoRobot.FAN_SPEEDS).find(key => {
                                return DreameValetudoRobot.FAN_SPEEDS[key] === elem.value;
                            });

                            this.state.upsertFirstMatchingAttribute(new stateAttrs.PresetSelectionStateAttribute({
                                metaData: {
                                    rawValue: elem.value
                                },
                                type: stateAttrs.PresetSelectionStateAttribute.TYPE.FAN_SPEED,
                                value: matchingFanSpeed
                            }));
                            break;
                        }

                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.WATER_USAGE.PIID: {
                            let matchingWaterGrade = Object.keys(DreameValetudoRobot.WATER_GRADES).find(key => {
                                return DreameValetudoRobot.WATER_GRADES[key] === elem.value;
                            });

                            this.state.upsertFirstMatchingAttribute(new stateAttrs.PresetSelectionStateAttribute({
                                metaData: {
                                    rawValue: elem.value
                                },
                                type: stateAttrs.PresetSelectionStateAttribute.TYPE.WATER_GRADE,
                                value: matchingWaterGrade
                            }));
                            break;
                        }
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.WATER_TANK_ATTACHMENT.PIID: {
                            this.state.upsertFirstMatchingAttribute(new entities.state.attributes.AttachmentStateAttribute({
                                type: entities.state.attributes.AttachmentStateAttribute.TYPE.WATERTANK,
                                attached: elem.value === 1
                            }));

                            this.state.upsertFirstMatchingAttribute(new entities.state.attributes.AttachmentStateAttribute({
                                type: entities.state.attributes.AttachmentStateAttribute.TYPE.MOP,
                                attached: elem.value === 1
                            }));
                            break;
                        }
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.CLEANING_TIME.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.CLEANING_AREA.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.STATE_CHANGE_TIMESTAMP.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.UNKNOWN_01.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.LOCATING_STATUS.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.CARPET_MODE.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.KEY_LOCK.PIID:
                        case MIOT_SERVICES.VACUUM_2.PROPERTIES.OBSTACLE_AVOIDANCE.PIID:
                            //ignored for now
                            break;

                        default:
                            Logger.warn("Unhandled VACUUM_2 property", elem);
                    }
                    break;
                }
                case MIOT_SERVICES.BATTERY.SIID: {
                    switch (elem.piid) {
                        case MIOT_SERVICES.BATTERY.PROPERTIES.LEVEL.PIID:
                            this.state.upsertFirstMatchingAttribute(new stateAttrs.BatteryStateAttribute({
                                level: elem.value
                            }));
                            break;
                        case MIOT_SERVICES.BATTERY.PROPERTIES.CHARGING.PIID:
                            /*
                                1 = On Charger
                                2 = Not on Charger
                                5 = Returning to Charger
                             */
                            this.isCharging = elem.value === 1;
                            this.stateNeedsUpdate = true;
                            break;
                    }
                    break;
                }

                case MIOT_SERVICES.MAIN_BRUSH.SIID:
                case MIOT_SERVICES.SIDE_BRUSH.SIID:
                case MIOT_SERVICES.FILTER.SIID:
                case MIOT_SERVICES.SENSOR.SIID:
                    this.consumableMonitoringCapability.parseConsumablesMessage(elem);
                    break;
                default:
                    Logger.warn("Unhandled property update", elem);
            }
        });


        if (this.stateNeedsUpdate === true) {
            let newState;
            let statusValue;
            let statusFlag;
            let statusMetaData = {};

            if (this.errorCode === "0" || this.errorCode === "") {
                statusValue = DreameValetudoRobot.STATUS_MAP[this.mode].value;
                statusFlag = DreameValetudoRobot.STATUS_MAP[this.mode].flag;

                if (statusValue === stateAttrs.StatusStateAttribute.VALUE.DOCKED && this.taskStatus !== 0) {
                    // Robot has a pending task but is charging due to low battery and will resume when battery >= 80%
                    statusFlag = stateAttrs.StatusStateAttribute.FLAG.RESUMABLE;
                } else if (statusValue === stateAttrs.StatusStateAttribute.VALUE.IDLE && statusFlag === undefined && this.isCharging === true) {
                    statusValue = stateAttrs.StatusStateAttribute.VALUE.DOCKED;
                }
            } else {
                if (this.errorCode === "68") { //Docked with mop still attached. For some reason, dreame decided to have this as an error
                    statusValue = stateAttrs.StatusStateAttribute.VALUE.DOCKED;
                    this.valetudoEventStore.raise(new MopAttachmentReminderValetudoEvent({}));
                } else {
                    statusValue = stateAttrs.StatusStateAttribute.VALUE.ERROR;

                    statusMetaData.error_code = this.errorCode;
                    statusMetaData.error_description = DreameValetudoRobot.GET_ERROR_CODE_DESCRIPTION(this.errorCode);
                }

            }

            newState = new stateAttrs.StatusStateAttribute({
                value: statusValue,
                flag: statusFlag,
                metaData: statusMetaData
            });

            this.state.upsertFirstMatchingAttribute(newState);

            if (newState.isActiveState) {
                this.pollMap();
            }

            this.stateNeedsUpdate = false;
        }



        this.emitStateAttributesUpdated();
    }

    startup() {
        super.startup();

        if (this.config.get("embedded") === true) {
            try {
                const {partitions, rootPartition} = Tools.PARSE_PROC_CMDLINE();

                if (partitions[rootPartition]) {
                    Logger.info(`Current rootfs: ${partitions[rootPartition]} (${rootPartition})`);
                }
            } catch (e) {
                Logger.warn("Unable to parse /proc/cmdline", e);
            }
        }
    }
}

DreameGen2ValetudoRobot.MIOT_SERVICES = MIOT_SERVICES;


module.exports = DreameGen2ValetudoRobot;
