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

# Description: Gets the config items supported for the given project
# Inputs:
# - full path to the directory for the project
# Outputs:
# - List of supported config properties of one of the following form if any are available for the given project.
#   { CONFIG_OPTION_NAME: {'default': DEFAULT_VALUE, 'secret': True|False, 'description': PROVIDED_DESCRIPTION} 
#   NOTE: The value map may be "None" if nothing but the configuration option name was provided in the template, or
#   may contain any or all of the items shown above (i.e. 'default', etc)
# Notes:
# - Only supports template config specified in the project yaml file.
# - Future: look for project and stack level config settings use that to build the list of config props as well?
def get_project_configoptions(project_dir: str):
  with open(f'{project_dir}/Pulumi.yaml') as f:
    project_config = yaml.safe_load(f)
  project_config_options = []
  if "template" in project_config:
    template_data = project_config["template"]
    if template_data and "config" in template_data:
      project_configs = template_data["config"]
      for configname, configoptions in project_configs.items():
        project_config_options.append({configname: configoptions})
  return(project_config_options)