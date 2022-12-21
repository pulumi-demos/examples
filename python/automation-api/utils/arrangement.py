import yaml

# Description: Gets the arrangement information (e.g. list of projects) for the given arrangement
# Inputs:
# - path to the arragements file
# - name of the arrangement being deployed
# Outputs:
# - List of the full paths for the project(s) that make up the arrangement.
def get_arrangement_info(arrangements_file: str, arrangement_name: str):
  # Parse the arrangements yaml and get the info for the specified arrangement 
  with open(arrangements_file) as f:
      arrangements_config = yaml.safe_load(f)
  # Get the base_folder information from the arrangements file
  base_folder = arrangements_config["base-folder"]
  # Get the list of arrangements from the arrangements file.
  arrangements = arrangements_config["arrangements"]
  # Get the specified arrangement
  # arrangement_object = [item for item in arrangements if item.get('name')==arrangement_name]
  arrangement_object = next(
    (item for item in arrangements if item["name"] == arrangement_name),
    None
  )
  # Build an array of the project folders for the arrangement
  arrangement_projects= []
  for project_folder in arrangement_object["project-folders"]:
    full_project_folder = f"{base_folder}/{project_folder}"
    arrangement_projects.append(full_project_folder)
  return { "project_folders": arrangement_projects }
