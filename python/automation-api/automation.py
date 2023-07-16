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
config_params = args.config
arrangements_file = "./arrangements.yaml"

# Build config map based on any config parameters passed on the command line.
config = []
for config_param in config_params:
    config_name_value = config_param.split("=")
    config.append({
        "name":config_name_value[0],
        "value":config_name_value[1]
    })

# The Pulumi projects are up two levels.
run_automation("../..", arrangements_file, arrangement_name, org, stack, destroy, config)




    

    





