from PaddleOCR.tools.infer.predict_system import TextSystem, sorted_boxes
from PaddleOCR.tools.infer import utility
from PaddleOCR.ppocr.utils.utility import get_image_file_list, check_and_read
from PaddleOCR.ppocr.utils.logging import get_logger
from PaddleOCR.tools.infer.utility import draw_ocr_box_txt, get_rotate_crop_image, get_minarea_rect_crop

logger = get_logger()

