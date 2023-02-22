from setuptools import setup, find_packages
# List of requirements
requirements = []  # This could be retrieved from requirements.txt
# Package (minimal) configuration
setup(
    name="components",
    version="0.0.1",
    description="component resources",
    py_modules=["aws_rds_backend", "aws_ecs_frontend", "aws_network", "azure_aks"],
    # packages=find_packages(),  # __init__.py folders search
    install_requires=requirements
)