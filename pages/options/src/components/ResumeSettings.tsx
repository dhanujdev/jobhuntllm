import { useState, useEffect } from 'react';
import { Button } from '@extension/ui';

interface ResumeSettingsProps {
  isDarkMode: boolean;
}

interface ResumeData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    linkedIn?: string;
    portfolio?: string;
    github?: string;
  };
  professional: {
    currentTitle: string;
    currentCompany?: string;
    totalExperience: string;
    summary: string;
    skills: {
      technical: string[];
      programming?: string[];
      languages?: string[];
    };
    availability: {
      startDate: string;
      remote: boolean;
      relocation: boolean;
    };
  };
  documents: {
    coverLetterTemplate: string;
  };
}

const defaultResumeData: ResumeData = {
  personalInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States',
    },
    linkedIn: '',
    portfolio: '',
    github: '',
  },
  professional: {
    currentTitle: '',
    currentCompany: '',
    totalExperience: '',
    summary: '',
    skills: {
      technical: [],
      programming: [],
      languages: [],
    },
    availability: {
      startDate: 'Immediate',
      remote: true,
      relocation: false,
    },
  },
  documents: {
    coverLetterTemplate: `Dear Hiring Manager,

I am writing to express my interest in the {currentTitle} position at {companyName}. With {experience} of experience in the field, I am confident that my skills make me a strong candidate for this role.

{summary}

I am excited about the opportunity to contribute to {companyName} and would welcome the chance to discuss how my background and enthusiasm can benefit your team.

Thank you for your consideration.

Best regards,
{firstName} {lastName}`,
  },
};

export function ResumeSettings({ isDarkMode }: ResumeSettingsProps) {
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [skillInput, setSkillInput] = useState('');

  // Load existing resume data on component mount
  useEffect(() => {
    loadResumeData();
  }, []);

  const loadResumeData = async () => {
    try {
      const result = await chrome.storage.local.get('jobhuntllm_resume_data');
      if (result.jobhuntllm_resume_data) {
        setResumeData(result.jobhuntllm_resume_data);
      }
    } catch (error) {
      console.error('Failed to load resume data:', error);
    }
  };

  const saveResumeData = async () => {
    setIsSaving(true);
    try {
      await chrome.storage.local.set({
        jobhuntllm_resume_data: resumeData,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save resume data:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePersonalInfo = (field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }));
  };

  const updateAddress = (field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        address: {
          ...prev.personalInfo.address,
          [field]: value,
        },
      },
    }));
  };

  const updateProfessional = (field: string, value: any) => {
    setResumeData(prev => ({
      ...prev,
      professional: {
        ...prev.professional,
        [field]: value,
      },
    }));
  };

  const addSkill = (category: 'technical' | 'programming' | 'languages') => {
    if (skillInput.trim()) {
      setResumeData(prev => ({
        ...prev,
        professional: {
          ...prev.professional,
          skills: {
            ...prev.professional.skills,
            [category]: [...(prev.professional.skills[category] || []), skillInput.trim()],
          },
        },
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (category: 'technical' | 'programming' | 'languages', index: number) => {
    setResumeData(prev => ({
      ...prev,
      professional: {
        ...prev.professional,
        skills: {
          ...prev.professional.skills,
          [category]: prev.professional.skills[category]?.filter((_, i) => i !== index) || [],
        },
      },
    }));
  };

  const inputClass = `w-full p-3 border rounded-lg ${
    isDarkMode
      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

  const labelClass = `block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Resume & Profile Settings
        </h2>
        <Button
          onClick={saveResumeData}
          disabled={isSaving}
          className={`px-6 py-2 rounded-lg font-medium ${
            saveStatus === 'success'
              ? 'bg-green-600 text-white'
              : saveStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          {isSaving
            ? 'Saving...'
            : saveStatus === 'success'
              ? 'Saved!'
              : saveStatus === 'error'
                ? 'Error'
                : 'Save Profile'}
        </Button>
      </div>

      {/* Personal Information */}
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow-lg`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name</label>
            <input
              type="text"
              value={resumeData.personalInfo.firstName}
              onChange={e => updatePersonalInfo('firstName', e.target.value)}
              className={inputClass}
              placeholder="John"
            />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input
              type="text"
              value={resumeData.personalInfo.lastName}
              onChange={e => updatePersonalInfo('lastName', e.target.value)}
              className={inputClass}
              placeholder="Doe"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={resumeData.personalInfo.email}
              onChange={e => updatePersonalInfo('email', e.target.value)}
              className={inputClass}
              placeholder="john.doe@email.com"
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={resumeData.personalInfo.phone}
              onChange={e => updatePersonalInfo('phone', e.target.value)}
              className={inputClass}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <h4 className={`text-lg font-medium mt-6 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Address</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>Street Address</label>
            <input
              type="text"
              value={resumeData.personalInfo.address.street}
              onChange={e => updateAddress('street', e.target.value)}
              className={inputClass}
              placeholder="123 Main St"
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={resumeData.personalInfo.address.city}
              onChange={e => updateAddress('city', e.target.value)}
              className={inputClass}
              placeholder="San Francisco"
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input
              type="text"
              value={resumeData.personalInfo.address.state}
              onChange={e => updateAddress('state', e.target.value)}
              className={inputClass}
              placeholder="CA"
            />
          </div>
          <div>
            <label className={labelClass}>ZIP Code</label>
            <input
              type="text"
              value={resumeData.personalInfo.address.zipCode}
              onChange={e => updateAddress('zipCode', e.target.value)}
              className={inputClass}
              placeholder="94102"
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              type="text"
              value={resumeData.personalInfo.address.country}
              onChange={e => updateAddress('country', e.target.value)}
              className={inputClass}
              placeholder="United States"
            />
          </div>
        </div>

        <h4 className={`text-lg font-medium mt-6 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Online Profiles
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>LinkedIn URL</label>
            <input
              type="url"
              value={resumeData.personalInfo.linkedIn}
              onChange={e => updatePersonalInfo('linkedIn', e.target.value)}
              className={inputClass}
              placeholder="https://linkedin.com/in/johndoe"
            />
          </div>
          <div>
            <label className={labelClass}>Portfolio URL</label>
            <input
              type="url"
              value={resumeData.personalInfo.portfolio}
              onChange={e => updatePersonalInfo('portfolio', e.target.value)}
              className={inputClass}
              placeholder="https://johndoe.dev"
            />
          </div>
          <div>
            <label className={labelClass}>GitHub URL</label>
            <input
              type="url"
              value={resumeData.personalInfo.github}
              onChange={e => updatePersonalInfo('github', e.target.value)}
              className={inputClass}
              placeholder="https://github.com/johndoe"
            />
          </div>
        </div>
      </div>

      {/* Professional Information */}
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow-lg`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Professional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Current Job Title</label>
            <input
              type="text"
              value={resumeData.professional.currentTitle}
              onChange={e => updateProfessional('currentTitle', e.target.value)}
              className={inputClass}
              placeholder="Senior Software Engineer"
            />
          </div>
          <div>
            <label className={labelClass}>Current Company</label>
            <input
              type="text"
              value={resumeData.professional.currentCompany}
              onChange={e => updateProfessional('currentCompany', e.target.value)}
              className={inputClass}
              placeholder="TechCorp Inc."
            />
          </div>
          <div>
            <label className={labelClass}>Total Experience</label>
            <input
              type="text"
              value={resumeData.professional.totalExperience}
              onChange={e => updateProfessional('totalExperience', e.target.value)}
              className={inputClass}
              placeholder="5 years"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Professional Summary</label>
          <textarea
            value={resumeData.professional.summary}
            onChange={e => updateProfessional('summary', e.target.value)}
            className={`${inputClass} h-24`}
            placeholder="Brief description of your professional background and key strengths..."
          />
        </div>

        {/* Skills Section */}
        <h4 className={`text-lg font-medium mt-6 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Skills</h4>

        {(['technical', 'programming', 'languages'] as const).map(category => (
          <div key={category} className="mb-4">
            <label className={labelClass}>
              {category === 'technical'
                ? 'Technical Skills'
                : category === 'programming'
                  ? 'Programming Languages'
                  : 'Languages'}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder={`Add ${category} skill...`}
                onKeyPress={e => e.key === 'Enter' && addSkill(category)}
              />
              <Button
                onClick={() => addSkill(category)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(resumeData.professional.skills[category] || []).map((skill, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                    isDarkMode ? 'bg-slate-600 text-white' : 'bg-gray-200 text-gray-800'
                  }`}>
                  {skill}
                  <button onClick={() => removeSkill(category, index)} className="ml-2 text-red-500 hover:text-red-700">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cover Letter Template */}
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'} shadow-lg`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Cover Letter Template
        </h3>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Use placeholders like {'{firstName}'}, {'{companyName}'}, {'{currentTitle}'}, {'{experience}'}, {'{summary}'}{' '}
          for dynamic content.
        </p>
        <textarea
          value={resumeData.documents.coverLetterTemplate}
          onChange={e =>
            setResumeData(prev => ({
              ...prev,
              documents: {
                ...prev.documents,
                coverLetterTemplate: e.target.value,
              },
            }))
          }
          className={`${inputClass} h-48`}
          placeholder="Write your cover letter template here..."
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveResumeData}
          disabled={isSaving}
          className={`px-8 py-3 rounded-lg font-medium ${
            saveStatus === 'success'
              ? 'bg-green-600 text-white'
              : saveStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          {isSaving
            ? 'Saving Profile...'
            : saveStatus === 'success'
              ? 'Profile Saved!'
              : saveStatus === 'error'
                ? 'Save Failed'
                : 'Save Profile'}
        </Button>
      </div>
    </div>
  );
}
