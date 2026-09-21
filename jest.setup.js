jest.mock('react-native-get-random-values', () => ({}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: (props) => React.createElement('RefreshControl', props),
    };
});

jest.mock('react-native-sqlite-storage', () => {
    const mockDb = {
        executeSql: jest.fn().mockResolvedValue([
            {
                rows: {
                    length: 0,
                    item: jest.fn(),
                },
            },
        ]),
    };

    return {
        enablePromise: jest.fn(),
        openDatabase: jest.fn(() => Promise.resolve(mockDb)),
    };
});