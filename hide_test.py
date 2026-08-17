import tkinter as tk
from tkinter import messagebox
import ctypes
from ctypes import wintypes
import sys

# Windows API constants
WDA_NONE = 0x00000000
WDA_EXCLUDEFROMCAPTURE = 0x00000011

class ProtectedWindow:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🔒 Screen Capture Protected Window")
        self.root.geometry("800x800")
        self.root.configure(bg='#1e1e3c')
        
        # Get window handle
        self.hwnd = None
        self.protected = False
        
        self.setup_ui()
        self.root.after(100, self.apply_protection)  # Apply protection after window is fully created
        
    def setup_ui(self):
        # Main frame
        main_frame = tk.Frame(self.root, bg='#1e1e3c', padx=20, pady=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_label = tk.Label(
            main_frame, 
            text="🔒 SCREEN CAPTURE PROTECTED 🔒",
            font=('Arial', 16, 'bold'),
            fg='white',
            bg='#1e1e3c'
        )
        title_label.pack(pady=(0, 20))
        
        # Instructions
        instructions = """This window should be invisible when:
• Screen sharing in video calls (Zoom, Teams, etc.)
• Recording with most screen recorders
• Taking screenshots with some tools

Try sharing your screen now to test!"""
        
        instructions_label = tk.Label(
            main_frame,
            text=instructions,
            font=('Arial', 11),
            fg='lightgray',
            bg='#1e1e3c',
            justify=tk.LEFT
        )
        instructions_label.pack(pady=(0, 20))
        
        # Status
        self.status_label = tk.Label(
            main_frame,
            text="Protection Status: Initializing...",
            font=('Arial', 12, 'bold'),
            fg='yellow',
            bg='#1e1e3c'
        )
        self.status_label.pack(pady=(0, 20))
        
        # Buttons frame
        buttons_frame = tk.Frame(main_frame, bg='#1e1e3c')
        buttons_frame.pack(pady=10)
        
        # Toggle button
        self.toggle_button = tk.Button(
            buttons_frame,
            text="Toggle Protection",
            command=self.toggle_protection,
            font=('Arial', 12),
            bg='#4CAF50',
            fg='white',
            padx=20,
            pady=10
        )
        self.toggle_button.pack(side=tk.LEFT, padx=(0, 10))
        
        # Test button
        test_button = tk.Button(
            buttons_frame,
            text="Test Instructions",
            command=self.show_test_instructions,
            font=('Arial', 12),
            bg='#2196F3',
            fg='white',
            padx=20,
            pady=10
        )
        test_button.pack(side=tk.LEFT)
        
        # Info text
        info_text = tk.Text(
            main_frame,
            height=8,
            width=70,
            bg='#2d2d2d',
            fg='lightgreen',
            font=('Consolas', 10),
            wrap=tk.WORD
        )
        info_text.pack(pady=(20, 0), fill=tk.BOTH, expand=True)
        
        # Add some informational text
        info_content = """TECHNICAL DETAILS:
• Uses SetWindowDisplayAffinity Windows API
• WDA_EXCLUDEFROMCAPTURE flag prevents most screen capture
• Effectiveness varies by capture method and application
• Modern screen sharing tools may still capture in some cases
• Press F5 to refresh protection status

This is for educational/testing purposes only."""
        
        info_text.insert(tk.END, info_content)
        info_text.config(state=tk.DISABLED)
        
        # Bind keys
        self.root.bind('<F5>', lambda e: self.apply_protection())
        self.root.bind('<Escape>', lambda e: self.toggle_protection())
        
    def get_window_handle(self):
        """Get the window handle (HWND) of the tkinter window"""
        if not self.hwnd:
            self.hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        return self.hwnd
    
    def apply_protection(self):
        """Apply screen capture protection to the window"""
        try:
            hwnd = self.get_window_handle()
            if hwnd:
                # Call SetWindowDisplayAffinity
                result = ctypes.windll.user32.SetWindowDisplayAffinity(
                    wintypes.HWND(hwnd), 
                    wintypes.DWORD(WDA_EXCLUDEFROMCAPTURE)
                )
                
                if result:
                    self.protected = True
                    self.status_label.config(text="Protection Status: ENABLED ✅", fg='lightgreen')
                    self.toggle_button.config(text="Disable Protection", bg='#f44336')
                    print("✅ Screen capture protection enabled successfully!")
                else:
                    error = ctypes.windll.kernel32.GetLastError()
                    self.status_label.config(text=f"Protection Status: FAILED (Error: {error})", fg='red')
                    print(f"❌ Failed to enable protection. Error code: {error}")
            else:
                self.status_label.config(text="Protection Status: No Window Handle", fg='red')
                print("❌ Could not get window handle")
                
        except Exception as e:
            self.status_label.config(text=f"Protection Status: ERROR - {str(e)}", fg='red')
            print(f"❌ Exception: {e}")
    
    def remove_protection(self):
        """Remove screen capture protection from the window"""
        try:
            hwnd = self.get_window_handle()
            if hwnd:
                result = ctypes.windll.user32.SetWindowDisplayAffinity(
                    wintypes.HWND(hwnd), 
                    wintypes.DWORD(WDA_NONE)
                )
                
                if result:
                    self.protected = False
                    self.status_label.config(text="Protection Status: DISABLED ❌", fg='red')
                    self.toggle_button.config(text="Enable Protection", bg='#4CAF50')
                    print("🔓 Screen capture protection disabled")
                else:
                    error = ctypes.windll.kernel32.GetLastError()
                    print(f"❌ Failed to disable protection. Error code: {error}")
                    
        except Exception as e:
            print(f"❌ Exception while removing protection: {e}")
    
    def toggle_protection(self):
        """Toggle screen capture protection on/off"""
        if self.protected:
            self.remove_protection()
        else:
            self.apply_protection()
    
    def show_test_instructions(self):
        """Show instructions for testing the protection"""
        message = """HOW TO TEST SCREEN CAPTURE PROTECTION:

1. SCREEN SHARING:
   • Start a video call (Zoom, Teams, Discord, etc.)
   • Share your screen
   • This window should appear black or be completely hidden

2. SCREEN RECORDING:
   • Use OBS, Bandicam, or Windows Game Bar
   • Start recording your desktop
   • This window should not appear in the recording

3. SCREENSHOTS:
   • Try Windows + Print Screen
   • Try Snipping Tool
   • Results may vary by method

NOTE: Protection effectiveness varies by application and method. 
Some tools may still capture the window."""
        
        messagebox.showinfo("Testing Instructions", message)
    
    def run(self):
        """Start the application"""
        print("🚀 Starting Screen Capture Protection Demo")
        print("📋 Window will attempt to hide from screen capture")
        print("🔄 Press F5 to refresh, ESC to toggle protection")
        self.root.mainloop()

if __name__ == "__main__":
    # Check if running on Windows
    if sys.platform != "win32":
        print("❌ This application only works on Windows!")
        sys.exit(1)
    
    try:
        app = ProtectedWindow()
        app.run()
    except Exception as e:
        print(f"❌ Failed to start application: {e}")
        input("Press Enter to exit...")