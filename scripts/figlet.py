from pyfiglet import Figlet
import sys

font = sys.argv[1]
text = sys.argv[2]
f = Figlet(font=font)
print(f.renderText(text))
