import argparse

# Build the command line arguments
def create_parser():
  parser = argparse.ArgumentParser(description="Pulumi automation API example.",
                                  formatter_class=argparse.ArgumentDefaultsHelpFormatter)
  parser.add_argument("-a", "--arrangement", required=True, help="name of arrangement to deploy (see arrangements.yaml)")
  parser.add_argument("-o", "--org", required=True, help="name of organization name use")
  parser.add_argument("-s", "--stack",  required=True, help="stack name (e.g. dev, prod)")
  parser.add_argument("-d", "--destroy", action="store_true", help="destroy the arrangement")
  parser.add_argument("-c", "--config", nargs="*", help="(optional) one or more configuration inputs of the form (namespace is optional): '[namespace]:configname=value'")
  return parser
