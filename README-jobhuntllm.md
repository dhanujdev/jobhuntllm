# JobHuntLLM v1.0

**AI-Powered Job Application Automation Tool**

JobHuntLLM is a specialized fork of Nanobrowser designed specifically for automating job applications efficiently. It streamlines your job search by intelligently filling forms, customizing applications, and tracking your progress.

## 🎯 Key Features for Job Hunters

### **Smart Application Automation**
- **Auto-Fill Forms**: Automatically populate job application forms using stored resume data
- **Platform Detection**: Recognizes major job platforms (LinkedIn, Indeed, Glassdoor, ATS systems)
- **Resume Management**: Store and reuse your professional information across applications
- **Custom Cover Letters**: Generate tailored cover letters based on job descriptions

### **Efficiency Optimizations**
- **Duplicate Detection**: Avoid applying to the same position twice
- **Application Tracking**: Keep detailed records of all applications
- **Template Responses**: Cache common answers to reduce LLM usage
- **Flow Patterns**: Save successful application workflows for reuse

### **Supported Platforms**
- **LinkedIn Easy Apply**: Streamlined multi-step workflow handling
- **Indeed Applications**: One-click and employer redirect support
- **ATS Systems**: Workday, Greenhouse, Lever, BambooHR, and more
- **Company Career Pages**: Custom portal navigation

## 🚀 Quick Start

### 1. **Installation**
- Build the extension: `pnpm build`
- Load the `dist` folder in Chrome as an unpacked extension
- Configure your LLM API keys in Settings

### 2. **Setup Your Resume**
The extension will prompt you to set up your resume data on first use:
- Personal information (name, email, phone, address)
- Professional experience and education
- Skills and certifications
- Cover letter template with placeholders

### 3. **Start Applying**
Simply say: *"Help me apply to software engineering jobs on LinkedIn"*

The AI will:
- Navigate to job platforms
- Detect application types
- Auto-fill forms with your data
- Generate custom cover letters
- Track applications for you

## 💡 Sample Commands

### **Job Search & Application**
- *"Find and apply to React developer jobs on Indeed"*
- *"Apply to this job posting"* (when on a job page)
- *"Fill out this application form"*

### **Data Management**
- *"Update my resume data"*
- *"Show my application history"*
- *"Check if I've applied to this company before"*

### **Platform-Specific**
- *"Use LinkedIn Easy Apply for this position"*
- *"Handle this Workday application"*
- *"Skip the salary question and continue"*

## 🛠️ Technical Architecture

### **Enhanced Agent System**
- **PlannerAgent**: Detects job application contexts and optimizes strategies
- **NavigatorAgent**: Specialized for form filling and platform navigation  
- **ValidatorAgent**: Ensures application completeness and success

### **Job-Specific Actions**
- `auto_fill_job_application`: Smart form completion
- `upload_resume`: Handle file uploads
- `generate_cover_letter`: Customize cover letters
- `track_application`: Save application details
- `handle_linkedin_easy_apply`: LinkedIn-specific workflow
- `detect_job_application_form`: Analyze form structures

### **Data Storage**
- **Resume Manager**: Structured storage for professional data
- **Application History**: Track all submitted applications
- **Flow Patterns**: Cache successful workflows for efficiency
- **Field Mapping**: Auto-detect common form fields

## 📊 Efficiency Features

### **Offline Operations**
- **Template Responses**: Pre-generated answers for common questions
- **Field Recognition**: Local pattern matching for form fields
- **Company Data Cache**: Store researched company information

### **Smart LLM Usage**
- Only use AI for custom content (cover letters, unique questions)
- Cache responses for similar positions/companies
- Template-based filling for standard fields
- Local processing for data mapping

### **Application Tracking**
```typescript
// Example application record
{
  jobTitle: "Senior React Developer",
  company: "TechCorp Inc.",
  platform: "LinkedIn",
  appliedDate: "2024-01-15",
  status: "applied",
  applicationId: "LC-123456",
  notes: "Referral from John Doe"
}
```

## 🔧 Configuration

### **Resume Data Schema**
The extension uses a structured schema for consistent data:
```typescript
{
  personalInfo: { name, email, phone, address },
  professional: { 
    currentTitle, experience, workHistory, education, skills 
  },
  preferences: { jobTypes, industries, locations },
  documents: { resumeFile, coverLetterTemplate }
}
```

### **Platform Settings**
- Configure different LLM models for different agents
- Set application preferences (salary ranges, remote work)
- Customize response templates for common questions

## 📈 Success Tracking

The extension provides detailed analytics:
- **Total Applications**: Count and trends
- **Platform Breakdown**: Success rates by platform
- **Response Rates**: Track interview invitations
- **Time Efficiency**: Monitor application completion times

## 🛡️ Privacy & Security

- **Local Storage**: All data stays in your browser
- **No Cloud Sync**: Your resume data never leaves your machine
- **API Key Security**: Use your own LLM provider keys
- **Audit Trail**: Complete logs of all actions taken

## 🚦 Development Status

### ✅ **Completed (v1.0)**
- Extension rebranding and job-focused prompts
- Resume data management system
- Job-specific action handlers
- Platform detection and workflows
- Application tracking and history

### 🔄 **In Progress**
- Template response optimization
- Advanced ATS system support
- Interview scheduling automation

### 📋 **Planned Features**
- Salary negotiation assistance
- Interview preparation tools
- Application status monitoring
- Integration with calendars and CRMs

## 🤝 Contributing

JobHuntLLM builds on the excellent foundation of Nanobrowser. Contributions welcome:
- Platform-specific workflow improvements
- Template optimizations for common questions
- New ATS system support
- Efficiency enhancements

## 📄 License

Apache License 2.0 - Same as the original Nanobrowser project.

---

**Made for job seekers, by job seekers** 🎯  
Transform your job search from tedious to efficient with AI automation.