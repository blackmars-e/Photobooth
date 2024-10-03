/* eslint n/no-unsupported-features/node-builtins: "off" */
/* globals photoBooth photoboothTools */
const photoboothPreview = (function () {
    // vars
    const CameraDisplayMode = {
            INIT: 1,
            BACKGROUND: 2,
            COUNTDOWN: 3,
            TEST: 4
        },
        PreviewMode = {
            NONE: 'none',
            DEVICE: 'device_cam',
            URL: 'url',
            ELGATO: 'elgato_cam'
        },
        webcamConstraints = {
            audio: false,
            video: {
                width: config.preview.videoWidth,
                height: config.preview.videoHeight,
                facingMode: config.preview.camera_mode
            }
        },
        elgatoConstraints = {
            audio: false,
            video: {
                width: config.preview.videoWidth,
                height: config.preview.videoHeight,
                deviceId: { exact: null } // Start with null and set later
            }
        },
        api = {};

    let pid,
        video,
        loader,
        url,
        pictureFrame,
        collageFrame,
        retryGetMedia = 3;

    // Find device by label (with case-insensitive partial matching)
    api.findDeviceByLabel = async function (label) {
        const devices = await navigator.mediaDevices.enumerateDevices();

        // Log all video input devices for debugging
        devices.forEach(device => {
            if (device.kind === 'videoinput') {
                console.log(`Device: ${device.label}, ID: ${device.deviceId}`);
            }
        });

        // Convert labels to lowercase for case-insensitive matching
        const videoDevice = devices.find(device => 
            device.kind === 'videoinput' && device.label.toLowerCase().includes(label.toLowerCase())
        );

        return videoDevice ? videoDevice.deviceId : null;
    };

    api.changeVideoMode = function (mode) {
        photoboothTools.console.logDev('Preview: Changing video mode: ' + mode);
        if (mode !== CameraDisplayMode.BACKGROUND) {
            loader.css('--stage-background', 'transparent');
        }
        video.show();
    };

    // Initialize media
    api.initializeMedia = async function (cb = () => {}) {
        photoboothTools.console.logDev('Preview: Trying to initialize media...');
        if (!navigator.mediaDevices || config.preview.mode === PreviewMode.NONE.valueOf() || config.preview.mode === PreviewMode.URL.valueOf()) {
            photoboothTools.console.logDev('Preview: No preview from device cam or no webcam available!');
            return;
        }

        const getMedia = navigator.mediaDevices.getUserMedia || navigator.mediaDevices.webkitGetUserMedia || navigator.mediaDevices.mozGetUserMedia || false;

        if (!getMedia) {
            photoboothTools.console.logDev('Preview: Could not get media!');
            return;
        }

        if (config.preview.mode === PreviewMode.ELGATO) {
            const deviceId = await api.findDeviceByLabel('Cam Link'); // Adjust this label if needed
            if (deviceId) {
                elgatoConstraints.video.deviceId = { exact: deviceId };
            } else {
                console.error('Elgato device not found');
                return; // Exit if the device is not found
            }

            try {
                const stream = await getMedia(elgatoConstraints);
                photoboothTools.console.logDev('Preview: Elgato getMedia done!');
                api.stream = stream;
                video.get(0).srcObject = stream; // Set the stream to the video element
                cb();
            } catch (error) {
                console.error('ERROR: Preview: Could not get user media for Elgato: ', error);
                handleMediaRetry(cb);
            }
        } else {
            try {
                const stream = await getMedia(webcamConstraints);
                photoboothTools.console.logDev('Preview: Webcam getMedia done!');
                api.stream = stream;
                video.get(0).srcObject = stream; // Set the stream to the video element
                cb();
            } catch (error) {
                console.error('ERROR: Preview: Could not get user media for webcam: ', error);
                handleMediaRetry(cb);
            }
        }
    };

    function handleMediaRetry(cb, retry = 0) {
        if (retry < retryGetMedia) {
            photoboothTools.console.logDev('Preview: Retrying to get user media. Retry ' + retry + ' / ' + retryGetMedia);
            retry += 1;
            setTimeout(() => {
                api.initializeMedia(cb, retry);
            }, 1000);
        } else {
            photoboothTools.console.logDev('ERROR: Preview: Unable to get user media. Failed retries: ' + retry);
        }
    }

    api.getAndDisplayMedia = async function (mode) {
        if (api.stream && api.stream.active) {
            api.changeVideoMode(mode);
        } else {
            await api.initializeMedia(() => {
                api.changeVideoMode(mode);
            });
        }
    };

    api.runCmd = function (mode) {
        const dataVideo = {
            play: mode,
            pid: pid
        };

        jQuery
            .post('api/previewCamera.php', dataVideo)
            .done(function (result) {
                photoboothTools.console.log('Preview: ' + dataVideo.play + ' webcam successfully.');
                pid = result.pid;
            })
            .fail(function () {
                photoboothTools.console.log('ERROR: Preview: Failed to ' + dataVideo.play + ' webcam!');
            });
    };

    api.startVideo = async function (mode, retry = 0, maxGetMediaRetry = 3) {
        retryGetMedia = maxGetMediaRetry;
        photoboothTools.console.log('Preview: startVideo mode: ' + mode);
        if (config.preview.mode !== PreviewMode.URL.valueOf()) {
            if (!navigator.mediaDevices || config.preview.mode === PreviewMode.NONE.valueOf()) {
                return;
            }
        }

        switch (mode) {
            case CameraDisplayMode.INIT:
                photoboothTools.console.logDev('Preview: Running preview cmd (INIT).');
                api.runCmd('start');
                break;
            case CameraDisplayMode.BACKGROUND:
                if ((config.preview.mode === PreviewMode.DEVICE || config.preview.mode === PreviewMode.ELGATO) && config.preview.cmd && !config.preview.bsm) {
                    photoboothTools.console.logDev('Preview: Running preview cmd (BACKGROUND).');
                    api.runCmd('start');
                }
                await api.getAndDisplayMedia(CameraDisplayMode.BACKGROUND);
                break;
            case CameraDisplayMode.COUNTDOWN:
                if (config.commands.preview) {
                    if (config.preview.bsm || (!config.preview.bsm && retry > 0) || (typeof photoBooth !== 'undefined' && photoBooth.nextCollageNumber > 0)) {
                        photoboothTools.console.logDev('Preview: Running preview cmd (COUNTDOWN).');
                        api.runCmd('start');
                    }
                }
                if (config.preview.mode === PreviewMode.DEVICE || config.preview.mode === PreviewMode.ELGATO) {
                    photoboothTools.console.logDev('Preview: Preview at countdown from device cam.');
                    await api.getAndDisplayMedia(CameraDisplayMode.COUNTDOWN);
                } else if (config.preview.mode === PreviewMode.URL.valueOf()) {
                    photoboothTools.console.logDev('Preview: Preview at countdown from URL.');
                    setTimeout(function () {
                        url.show();
                        url.addClass('streaming');
                    }, config.preview.url_delay);
                }
                break;
            case CameraDisplayMode.TEST:
                if (config.preview.mode === PreviewMode.DEVICE || config.preview.mode === PreviewMode.ELGATO) {
                    photoboothTools.console.logDev('Preview: Preview from device cam.');
                    await api.getAndDisplayMedia(CameraDisplayMode.TEST);
                } else if (config.preview.mode === PreviewMode.URL.valueOf()) {
                    photoboothTools.console.logDev('Preview: Preview from URL.');
                    setTimeout(function () {
                        url.show();
                        url.addClass('streaming');
                    }, config.preview.url_delay);
                }
                break;
            default:
                photoboothTools.console.log('ERROR: Preview: Call for unexpected video mode: ' + mode);
                break;
        }
    };

    api.stopPreview = function () {
        if (config.commands.preview_kill) {
            api.runCmd('stop');
        }
        if (config.preview.mode === PreviewMode.DEVICE || config.preview.mode === PreviewMode.ELGATO) {
            api.stopVideo();
        } else if (config.preview.mode === PreviewMode.URL.valueOf()) {
            url.removeClass('streaming');
            url.hide();
        }
    };

    api.stopVideo = function () {
        loader.css('--stage-background', null);
        if (api.stream) {
            api.stream.getTracks().forEach(track => track.stop());
            api.stream = null;
        }
        video.hide();
        pictureFrame.hide();
        collageFrame.hide();
    };

    api.setElements = () => {
        video = $('#preview--video');
        loader = $('.stage[data-stage="loader"]');
        url = $('#preview--ipcam');
        pictureFrame = $('#previewframe--picture');
        collageFrame = $('#previewframe--collage');
    };

    api.init = function () {
        api.setElements();
    };

    return api;
})();

$(function () {
    photoboothPreview.init();
    photoboothTools.console.log('Preview: Preview functions available.');
});
