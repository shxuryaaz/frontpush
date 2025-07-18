import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser } from '@/lib/firebaseAuth';
import { 
  saveLinearConfig, 
  getLinearConfig, 
  saveAsanaConfig, 
  getAsanaConfig,
  updateLinearConfig,
  updateAsanaConfig
} from '@/lib/firebaseUserConfig';
import { ArrowLeft, Save, Edit, CheckCircle } from 'lucide-react';

interface ConfigFormData {
  apiKey?: string;
  workspaceId?: string;
  personalAccessToken?: string;
  projectId?: string;
}

const ConfigureApp = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ConfigFormData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [existingConfig, setExistingConfig] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUserAndExistingConfig = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);

      // Check for existing configuration
      if (appId === 'linear') {
        const config = await getLinearConfig(currentUser.uid);
        if (config?.isConfigured) {
          setExistingConfig(config);
          setFormData({
            apiKey: config.apiKey,
            workspaceId: config.workspaceId
          });
        }
      } else if (appId === 'asana') {
        const config = await getAsanaConfig(currentUser.uid);
        if (config?.isConfigured) {
          setExistingConfig(config);
          setFormData({
            personalAccessToken: config.personalAccessToken,
            projectId: config.projectId
          });
        }
      }
    };

    checkUserAndExistingConfig();
  }, [appId, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (appId === 'linear') {
      return formData.apiKey && formData.workspaceId;
    } else if (appId === 'asana') {
      return formData.personalAccessToken && formData.projectId;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (appId === 'linear') {
        if (existingConfig?.isConfigured) {
          // Update existing configuration
          await updateLinearConfig(user.uid, {
            apiKey: formData.apiKey!,
            workspaceId: formData.workspaceId!,
            isConfigured: true
          });
        } else {
          // Save new configuration
          await saveLinearConfig(user.uid, {
            apiKey: formData.apiKey!,
            workspaceId: formData.workspaceId!,
            isConfigured: true
          });
        }
        setSuccess('Linear configuration updated successfully!');
      } else if (appId === 'asana') {
        if (existingConfig?.isConfigured) {
          // Update existing configuration
          await updateAsanaConfig(user.uid, {
            personalAccessToken: formData.personalAccessToken!,
            projectId: formData.projectId!,
            isConfigured: true
          });
        } else {
          // Save new configuration
          await saveAsanaConfig(user.uid, {
            personalAccessToken: formData.personalAccessToken!,
            projectId: formData.projectId!,
            isConfigured: true
          });
        }
        setSuccess('Asana configuration updated successfully!');
      }

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard', { state: { platform: appId } });
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const getAppInfo = () => {
    switch (appId) {
      case 'linear':
        return {
          name: 'Linear',
          description: 'Configure your Linear workspace for voice-powered task management',
          color: 'from-purple-500 to-purple-600',
          icon: '📊',
          fields: [
            {
              name: 'apiKey',
              label: 'API Key',
              placeholder: 'Enter your Linear API key',
              type: 'password',
              description: 'Get your API key from Linear Settings > API'
            },
            {
              name: 'workspaceId',
              label: 'Workspace ID',
              placeholder: 'Enter your workspace ID',
              type: 'text',
              description: 'Find your workspace ID in Linear Settings > Workspace'
            }
          ]
        };
      case 'asana':
        return {
          name: 'Asana',
          description: 'Configure your Asana project for voice-powered task management',
          color: 'from-orange-500 to-orange-600',
          icon: '📋',
          fields: [
            {
              name: 'personalAccessToken',
              label: 'Personal Access Token',
              placeholder: 'Enter your personal access token',
              type: 'password',
              description: 'Create a personal access token in Asana Settings > Apps'
            },
            {
              name: 'projectId',
              label: 'Project ID',
              placeholder: 'Enter your project ID',
              type: 'text',
              description: 'Find your project ID in the project URL'
            }
          ]
        };
      default:
        return null;
    }
  };

  const appInfo = getAppInfo();

  if (!appInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Invalid App</h2>
            <p className="text-gray-600 mb-4">The selected app is not supported for configuration.</p>
            <Button onClick={() => navigate('/select-app')}>
              Back to App Selection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/select-app')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to App Selection
          </Button>
          
          <div className="flex items-center space-x-4 mb-4">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${appInfo.color} flex items-center justify-center text-2xl`}>
              {appInfo.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Configure {appInfo.name}
              </h1>
              <p className="text-gray-600">{appInfo.description}</p>
            </div>
          </div>
        </motion.div>

        {/* Configuration Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {existingConfig?.isConfigured ? 'Update Configuration' : 'Initial Setup'}
                </span>
                {existingConfig?.isConfigured && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-600">Currently Configured</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {appInfo.fields.map((field, index) => (
                  <motion.div
                    key={field.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.1 }}
                    className="space-y-2"
                  >
                    <Label htmlFor={field.name} className="text-sm font-medium">
                      {field.label}
                    </Label>
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.name as keyof ConfigFormData] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      className="w-full"
                      disabled={!isEditing && existingConfig?.isConfigured}
                    />
                    <p className="text-xs text-gray-500">{field.description}</p>
                  </motion.div>
                ))}

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <p className="text-sm text-red-600">{error}</p>
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-md"
                  >
                    <p className="text-sm text-green-600">{success}</p>
                  </motion.div>
                )}

                <div className="flex space-x-4 pt-4">
                  {existingConfig?.isConfigured && !isEditing ? (
                    <Button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Configuration
                    </Button>
                  ) : (
                    <>
                      {existingConfig?.isConfigured && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            setFormData({
                              apiKey: existingConfig.apiKey,
                              workspaceId: existingConfig.workspaceId,
                              personalAccessToken: existingConfig.personalAccessToken,
                              projectId: existingConfig.projectId
                            });
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={loading || !validateForm()}
                        className="flex-1"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            {existingConfig?.isConfigured ? 'Update Configuration' : 'Save Configuration'}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ConfigureApp; 