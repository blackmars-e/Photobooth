import logging
import argparse
import os
import signal
import subprocess
import sys
import time
import zmq
import socket
import re
from typing import Any, List
from argparse import Namespace
from subprocess import Popen, PIPE
from datetime import datetime, timedelta


def get_elgato_device() -> str:
    """
    Detects Elgato Cam Link 4K and returns the device path
    """
    try:
        output = subprocess.run(
            "v4l2-ctl --list-devices",
            capture_output=True,
            shell=True,
            check=True,
            text=True,
        )
        match = re.search(r"Cam Link 4K: Cam Link 4K.*\n\s*(/dev/video\d+)", output.stdout, re.M)
        if match:
            return match.group(1)
        else:
            raise DeviceNotFoundException("Elgato Cam Link 4K not found")
    except subprocess.CalledProcessError as e:
        log.error(e)
        raise DeviceNotFoundException("Error detecting Elgato Cam Link 4K")

def get_v4l2_devices() -> list[str]:
    """
    Detects v4l2 and returns them as a list of strings
    """
    devices = []

    try:
        output = subprocess.run(
            "v4l2-ctl --list-devices",
            capture_output=True,
            shell=True,
            check=True,
            text=True,
        )
        for dev in re.findall(
            r"platform:v4l2loopback-\d\d\d\):\n\s*([^\n]+)",
            output.stdout,
            re.M,
        ):
            devices.append(dev)

    except subprocess.CalledProcessError as e:
        log.error(e)

    return devices


def main():
    print(get_elgato_device())


if __name__ == "__main__":
    main()
