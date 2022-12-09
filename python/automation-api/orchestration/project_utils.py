import os
import json
import yaml

def get_project_info(project_dir: str):
  with open(f'{project_dir}/Pulumi.yaml') as f:
    project_config = yaml.safe_load(f)
  project_info = {}
  project_info["project_name"] = project_config["name"]
  project_info["language"] = project_config["runtime"]
  project_info["project_dir"] = project_dir
  return(project_info)

# def get_subfolders(base_dir: str):
#   subfolders = [ f.path for f in os.scandir(base_dir) if f.is_dir() ]
#   return(subfolders)

# def get_projects():
#   base_dir = get_project_base_dir()
#   # Get all directories under base_dir
#   subfolders = get_subfolders(base_dir)
#   # Identify project folders by the existence of the Pulumi.yaml file
#   projects = []
#   for folder in subfolders:
#     if (os.path.isfile(folder+"/Pulumi.yaml")):
#       folder_name = os.path.basename(folder)
#       projects.append((folder_name, folder_name))
#   return(projects)

# def get_project_base_dir():
#   return(os.path.join(os.path.dirname(__file__), "..", "projects")) 

# Returns list of deployment options for display in self-service form.
# Current Format: [(deployment_option_name, deployment_option_name)]
def get_deployment_options():
  deployment_options = get_deployment_options_array()
  deployment_options_list = []
  for deployment_option in deployment_options:
    deployment_option_name = deployment_option["name"]
    # deployment_options_list.append((deployment_option_name, deployment_option_name))
    deployment_options_list.append(deployment_option_name)
  return(deployment_options_list)

# returns list of projects to deploy for a given deployment option as defined in the 
# deployment_options.json
def get_deployment_projects(selected_deployment_option: str):
  deployment_options = get_deployment_options_array()
  for deployment_option in deployment_options:
    if (deployment_option["name"] == selected_deployment_option):
      return(deployment_option["projects"])

# returns language for the deployment option
def get_deployment_language(selected_deployment_option: str):
  deployment_options = get_deployment_options_array()
  for deployment_option in deployment_options:
    if (deployment_option["name"] == selected_deployment_option):
      return(deployment_option["language"])

# Returns array of the deployment options given in the deployment_options json file
def get_deployment_options_array():
  base_dir = get_project_base_dir()
  deployment_options_file = "deployment_options.json"
  # Opening offerings json file
  f = open(os.path.join(base_dir, deployment_options_file))
  deployment_options = json.load(f)
  # Close file
  f.close()
  return(deployment_options["deployment_options"])


