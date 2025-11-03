# Tabula Notes

A modern note-taking application built with Next.js.

## Features

- **Note Management**: Create, edit, delete, and organize multiple notes
- **Google Drive Sync**: Sync your notes with Google Drive for cloud backup
- **AI Summarization**: Generate AI-powered summaries of your notes
- **Export Functionality**: Export notes as text files
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: Works on desktop and mobile devices
- **Editor Ready**: Placeholder ready for your custom editor implementation

## Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Google Drive API**: Cloud synchronization

## Getting Started

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Run the development server:

   ```bash
   yarn dev
   ```

3. Open [http://localhost:9002](http://localhost:9002) in your browser.

## Editor Implementation

The application currently shows a placeholder where you can implement your own editor:

- **Clean slate**: No editor implementation - ready for your custom solution
- **Note data available**: Access to note content and change handlers
- **Responsive design**: Works on all device sizes
- **Flexible**: Implement any editor library or custom solution

## Google Drive Integration

To enable Google Drive sync:

1. The app will prompt you to sign in when you click the sync button
2. Grant permissions to access your Google Drive
3. Your notes will be automatically synced to a "Tabula Notes" folder in your Drive

## Development

The main application logic is in `src/app/page.tsx`. The editor area is currently a placeholder ready for your implementation.

## Adding Your Editor

To implement your own editor:

1. **Create your editor component** in `src/components/`
2. **Replace the placeholder** in `src/app/page.tsx` around line 562
3. **Use the available props**:
   - `activeNote.content` - current note content
   - `handleContentChange` - function to update content
   - `isRenaming` - whether note is being renamed (disable editing)

The application provides all the infrastructure for note management, you just need to add your editor implementation.
