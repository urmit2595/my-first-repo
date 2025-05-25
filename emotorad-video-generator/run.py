#!/usr/bin/env python3
"""
Emotorad Motion Video Generator - Quick Start
"""

import subprocess
import sys
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

console = Console()

def check_requirements():
    """Check and install requirements"""
    try:
        import openai
        import typer
        import rich
        import PIL
        import cv2
        console.print("✅ All requirements installed")
        return True
    except ImportError as e:
        console.print(f"📦 Installing requirements...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ])
        return False

def check_env():
    """Check environment setup"""
    if not Path(".env").exists():
        console.print("⚠️  Creating .env file...")
        
        if Path(".env.example").exists():
            import shutil
            shutil.copy(".env.example", ".env")
            console.print("📝 Please edit .env and add your OpenAI API key!")
            return False
    
    # Check API key
    from dotenv import load_dotenv
    import os
    load_dotenv()
    
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_api_key_here":
        console.print("❌ Please add your OpenAI API key to .env file!")
        return False
    
    return True

def display_quick_menu():
    """Display quick action menu"""
    menu = """
🎬 QUICK ACTIONS:

1. Generate ALL scenes (with motion optimization)
2. Generate with creative variations
3. Preview timeline and prompts
4. Generate single scene
5. Create video package from existing
6. View sample motion prompt
7. Clean all outputs

0. Exit
"""
    console.print(Panel(menu, title="[bold cyan]Emotorad Motion Generator[/bold cyan]"))

def main():
    console.print("\n[bold cyan]🎬 Emotorad Motion Video Generator[/bold cyan]")
    console.print("=" * 50)
    
    # Check setup
    if not check_requirements():
        console.print("\n🔄 Please run again after installation")
        return
    
    if not check_env():
        return
    
    console.print("\n✅ [green]Ready to create motion magic![/green]")
    
    while True:
        display_quick_menu()
        choice = Prompt.ask("Select action", choices=["0","1","2","3","4","5","6","7"])
        
        if choice == "0":
            console.print("\n👋 Thank you for using Emotorad Generator!")
            break
            
        elif choice == "1":
            # Generate all with motion
            console.print("\n🚀 Generating all scenes with motion optimization...")
            subprocess.call([sys.executable, "main.py", "generate", "--yes"])
            
        elif choice == "2":
            # Generate with variations
            num = Prompt.ask("How many variations per scene?", default="2")
            subprocess.call([
                sys.executable, "main.py", "generate", 
                "--variations", "--num-variations", num, "--yes"
            ])
            
        elif choice == "3":
            # Preview
            subprocess.call([sys.executable, "main.py", "preview"])
            
        elif choice == "4":
            # Single scene
            scene = Prompt.ask("Which scene? (1-9)", default="1")
            subprocess.call([
                sys.executable, "main.py", "generate", 
                "--scene", scene
            ])
            
        elif choice == "5":
            # Create package
            subprocess.call([sys.executable, "main.py", "package"])
            
        elif choice == "6":
            # View sample prompt
            subprocess.call([sys.executable, "main.py", "preview"])
            
        elif choice == "7":
            # Clean
            subprocess.call([sys.executable, "main.py", "clean"])
        
        input("\nPress Enter to continue...")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n\n👋 Goodbye!")
    except Exception as e:
        console.print(f"\n❌ Error: {e}")
