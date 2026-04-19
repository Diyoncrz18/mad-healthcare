jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));