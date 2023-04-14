import yaml
from utils.argsparser import create_parser
from utils.run_automation import run_automation

# Get the command line arguments
parser = create_parser()
args = parser.parse_args()
arrangement_name = args.arrangement
org = args.org
stack = args.stack
destroy = args.destroy
arrangements_file = "./arrangements.yaml"

run_automation(arrangements_file, arrangement_name, org, stack, destroy)




    

    





