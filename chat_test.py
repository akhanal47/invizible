import tkinter as tk
from tkinter import scrolledtext, messagebox
import ctypes
from ctypes import wintypes

# Constants for Windows display affinity
WDA_NONE = 0x00000000
WDA_EXCLUDEFROMCAPTURE = 0x00000011

class ProtectedChatWindow:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("🔒 LLM Chat (Screen Capture Protected)")
        self.root.geometry("800x600")
        self.root.configure(bg='#1e1e3c')
        self.hwnd = None
        self.protected = False

        self.setup_ui()
        self.root.after(100, self.apply_protection)

    def setup_ui(self):
        main_frame = tk.Frame(self.root, bg='#1e1e3c', padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Chat display
        self.chat_box = scrolledtext.ScrolledText(
            main_frame, wrap=tk.WORD, state=tk.DISABLED,
            bg='#2d2d2d', fg='white', font=('Consolas', 11),
            height=15
        )
        self.chat_box.pack(fill=tk.BOTH, expand=True, pady=(0,10))

        # User input
        input_frame = tk.Frame(main_frame, bg='#1e1e3c')
        input_frame.pack(fill=tk.X)
        self.entry = tk.Entry(input_frame, font=('Consolas', 11))
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,5))
        self.entry.bind("<Return>", lambda e: self.on_send())
        send_btn = tk.Button(input_frame, text="Send", command=self.on_send)
        send_btn.pack(side=tk.RIGHT)

        # Protection status & controls
        status_frame = tk.Frame(main_frame, bg='#1e1e3c', pady=10)
        status_frame.pack(fill=tk.X)
        self.status_label = tk.Label(
            status_frame, text="Protection: Initializing...",
            font=('Arial', 10, 'bold'), fg='yellow', bg='#1e1e3c'
        )
        self.status_label.pack(side=tk.LEFT)
        toggle_btn = tk.Button(
            status_frame, text="Toggle Protection",
            command=self.toggle_protection
        )
        toggle_btn.pack(side=tk.RIGHT)

    def get_window_handle(self):
        if not self.hwnd:
            self.hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        return self.hwnd

    def apply_protection(self):
        hwnd = self.get_window_handle()
        if hwnd:
            res = ctypes.windll.user32.SetWindowDisplayAffinity(
                wintypes.HWND(hwnd),
                wintypes.DWORD(WDA_EXCLUDEFROMCAPTURE)
            )
            if res:
                self.protected = True
                self.status_label.config(text="Protection: ENABLED ✅", fg='lightgreen')
            else:
                err = ctypes.windll.kernel32.GetLastError()
                self.status_label.config(text=f"Protection: FAILED ({err})", fg='red')

    def remove_protection(self):
        hwnd = self.get_window_handle()
        if hwnd:
            res = ctypes.windll.user32.SetWindowDisplayAffinity(
                wintypes.HWND(hwnd),
                wintypes.DWORD(WDA_NONE)
            )
            if res:
                self.protected = False
                self.status_label.config(text="Protection: DISABLED ❌", fg='red')

    def toggle_protection(self):
        if self.protected:
            self.remove_protection()
        else:
            self.apply_protection()

    def call_llm_api(self, prompt: str) -> str:
        # TODO: replace with real API call
        return f"[LLM] Echo: {prompt}"

    def on_send(self):
        user_msg = self.entry.get().strip()
        if not user_msg:
            return
        self.chat_box.config(state=tk.NORMAL)
        self.chat_box.insert(tk.END, f"You: {user_msg}\n")
        self.chat_box.see(tk.END)
        self.entry.delete(0, tk.END)

        response = self.call_llm_api(user_msg)
        self.chat_box.insert(tk.END, f"LLM: {response}\n\n")
        self.chat_box.see(tk.END)
        self.chat_box.config(state=tk.DISABLED)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = ProtectedChatWindow()
    app.run()
