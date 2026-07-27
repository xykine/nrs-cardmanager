from __future__ import annotations

import logging
import os

import cv2

logger = logging.getLogger(__name__)


def load_haar_cascade(filename: str):
    """Load a bundled OpenCV Haar cascade, or return None if this cv2 build lacks it."""
    cascade_cls = getattr(cv2, "CascadeClassifier", None)
    data = getattr(cv2, "data", None)
    haarcascades = getattr(data, "haarcascades", None)

    if cascade_cls is None or not haarcascades:
        logger.warning(
            "OpenCV Haar cascade support is unavailable; cv2_file=%s cv2_version=%s "
            "has_CascadeClassifier=%s has_data_haarcascades=%s",
            getattr(cv2, "__file__", None),
            getattr(cv2, "__version__", None),
            cascade_cls is not None,
            bool(haarcascades),
        )
        return None

    cascade_path = os.path.join(haarcascades, filename)
    cascade = cascade_cls(cascade_path)
    if cascade.empty():
        logger.warning("OpenCV Haar cascade failed to load: %s", cascade_path)
        return None

    return cascade
