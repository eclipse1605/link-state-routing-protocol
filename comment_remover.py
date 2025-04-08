import os
import re
import sys
from pathlib import Path

def remove_js_comments(content):
    content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    return content

def remove_python_comments(content):
    content = re.sub(r'#.*?$', '', content, flags=re.MULTILINE)
    content = re.sub(r"'''.*?'''", '', content, flags=re.DOTALL)
    content = re.sub(r'""".*?"""', '', content, flags=re.DOTALL)
    return content

def remove_html_comments(content):
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
    return content

def remove_comments(file_path):
    """Remove comments from a file based on its extension."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original_size = len(content)
    extension = file_path.suffix.lower()

    if extension in ['.js', '.jsx', '.ts', '.tsx', '.json']:
        content = remove_js_comments(content)
    elif extension in ['.py']:
        content = remove_python_comments(content)
    elif extension in ['.html', '.htm', '.xml']:
        content = remove_html_comments(content)
    elif extension in ['.css']:
        content = remove_js_comments(content)
        content = remove_html_comments(content)
    else:
        print(f"Skipping {file_path}: unsupported file type")
        return
    if len(content) != original_size:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        removed = original_size - len(content)
        print(f"Removed {removed} bytes of comments from {file_path}")
    else:
        print(f"No comments found in {file_path}")

def process_directory(directory_path, exclude_dirs=None, exclude_files=None):
    """Process all files in the directory and its subdirectories."""
    if exclude_dirs is None:
        exclude_dirs = ['.git', '.venv', 'node_modules', '__pycache__']
    
    if exclude_files is None:
        exclude_files = []

    path = Path(directory_path)
    
    for item in path.glob('**/*'):
        if item.is_file():
            if any(excluded in item.parts for excluded in exclude_dirs):
                continue
                
            if item.name in exclude_files:
                continue
                
            try:
                remove_comments(item)
            except Exception as e:
                print(f"Error processing {item}: {e}")

if __name__ == "__main__":
    directory = sys.argv[1] if len(sys.argv) > 1 else '.'
    print(f"Removing comments from all files in {directory}")
    
    exclude_dirs = ['.git', '.venv', 'node_modules', '__pycache__']
    exclude_files = ['comment_remover.py']  
    
    process_directory(directory, exclude_dirs, exclude_files)
    print("Comment removal complete!") 