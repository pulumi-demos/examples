import yaml
from utils.argsparser import create_parser
from utils.run_automation import run_automation
from utils.run_automation import gen_config_list

# Get the command line arguments
parser = create_parser()
args = parser.parse_args()
arrangement_name = args.arrangement
org = args.org
stack = args.stack
destroy = args.destroy
config_params = args.config
arrangements_file = "./arrangements.yaml"

# Build config map based on any config parameters passed on the command line.
config = gen_config_list(config_params)

# The Pulumi projects are up two levels.
run_automation("../..", arrangements_file, arrangement_name, org, stack, destroy, config)




    

    





