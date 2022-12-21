import os
import subprocess

def prep_workspaces(projects):
  for project in projects:
    prep_workspace(project["project_dir"], project["language"])

# Utilities to prep the project folder for launching the given project
def prep_workspace(project_dir: str, language: str):
  print('project_dir: ', project_dir)
  if language == "python":
    prep_python_workspace(project_dir)
  elif language == "nodejs":
    prep_nodejs_workspace(project_dir)
  else:
    print('No prep action taken for language: ', language)

def prep_python_workspace(project_dir: str):
  print("preparing virtual environment...")
  subprocess.run(["python3", "-m", "venv", "venv"], check=True, cwd=project_dir, capture_output=True)
  subprocess.run([os.path.join("venv", "bin", "python3"), "-m", "pip", "install", "--upgrade", "pip"],
              check=True, cwd=project_dir, capture_output=True)
  subprocess.run([os.path.join("venv", "bin", "pip"), "install", "-r", "requirements.txt"],
              check=True, cwd=project_dir, capture_output=True)
  print("virtual environment is ready!")

def prep_nodejs_workspace(project_dir: str):
  print("preparing typescript environment...")
  subprocess.run(["npm", "install"], check=True, cwd=project_dir, capture_output=True)
  print("typescript environment is ready!")