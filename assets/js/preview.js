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
        // Removed `webcamConstraints` since it's not used in the code
        elgatoConstraints = {
            audio: false,
            video: {
                width: config.preview.videoWidth,
                height: config.preview.videoHeight,
                label: 'Cam Link'
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

    api.changeVideoMode = function (mode) {
        photoboothTools.console.logDev('Preview: Changing video mode: ' + mode);
        if (mode !== CameraDisplayMode.BACKGROUND) {
            loader.css('--stage-background', 'transparent');
        }
        video.show();
    };

    api.initializeMedia = async function (
        cb = () => {
            // No-op: Placeholder for optional callback
        },
        retry = 0
    ) {
        photoboothTools.console.logDev('Preview: Trying to initialize media...');
        if (
            !navigator.mediaDevices ||
            config.preview.mode === PreviewMode.NONE ||
            config.preview.mode === PreviewMode.URL
        ) {
            photoboothTools.console.logDev('Preview: No preview from device cam or no webcam available!');
            return;
        }
        const getMedia =
            navigator.mediaDevices.getUserMedia ||
            navigator.mediaDevices.webkitGetUserMedia ||
            navigator.mediaDevices.mozGetUserMedia ||
            false;

        if (!getMedia) {
            photoboothTools.console.logDev('Preview: Could not get media!');
            return;
        }

        if (config.preview.mode === PreviewMode.ELGATO && elgatoConstraints.video.label) {
            const deviceId = await api.findDeviceByLabel(elgatoConstraints.video.label);
            if (deviceId) {
                elgatoConstraints.video.deviceId = { exact: deviceId };
            }
        }

        try {
            const stream = await getMedia(elgatoConstraints);
            photoboothTools.console.logDev('Preview: getMedia done!');
            api.stream = stream;
            video.get(0).srcObject = stream;
            cb();
        } catch (error) {
            photoboothTools.console.log('ERROR: Preview: Could not get user media: ', error);
            if (retry < retryGetMedia) {
                photoboothTools.console.logDev(
                    'Preview: Retrying to get user media. Retry ' + retry + ' / ' + retryGetMedia
                );
                retry += 1;
                setTimeout(function () {
                    api.initializeMedia(cb, retry);
                }, 1000);
            } else {
                photoboothTools.console.logDev(
                    'ERROR: Preview: Unable to get user media. Failed retries: ' + retry
                );
            }
        }
    };

    // Other functions remain the same...
})();
