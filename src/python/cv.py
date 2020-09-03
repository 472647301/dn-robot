import os
import sys
from cv2 import cv2 
from PIL import ImageGrab

name = sys.argv[1]
x = int(sys.argv[2])
y = int(sys.argv[3])

bbox = (x - 5, y - 5, x + 5, y + 5)
screenshots = ImageGrab.grab(bbox)
screenshots.save('{0}/screenshots/{1}.png'.format(os.path.expanduser('~'), name))

img = cv2.imread('{0}/screenshots/{1}.png'.format(os.path.expanduser('~'), name))
b, g, r = img[5, 5]
print('{0},{1},{2}'.format(r, g, b))