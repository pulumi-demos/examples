import yaml

# Description: Gets the project-related information from the Project folder.
# Inputs:
# - full path to the directory for the project
# Outputs:
# - Dictionary containing project information:
#   - project name
#   - project language
#   - project directory (same as input)
def get_project_info(project_dir: str):
  with open(f'{project_dir}/Pulumi.yaml') as f:
    project_config = yaml.safe_load(f)
  project_info = {}
  project_info["project_name"] = project_config["name"]
  project_info["language"] = project_config["runtime"]
  project_info["project_dir"] = project_dir
  return(project_info)
