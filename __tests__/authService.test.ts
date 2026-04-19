import { Alert } from 'react-native';
import { validateAuthInput } from '../Screens/services/authService';

describe('validateAuthInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid email', () => {
    expect(validateAuthInput('invalid-email', '123456')).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('rejects short password', () => {
    expect(validateAuthInput('user@example.com', '123')).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('accepts valid credentials', () => {
    expect(validateAuthInput('user@example.com', '123456')).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});