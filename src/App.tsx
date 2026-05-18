import ContextProvider from '@/viewModels/ContextProvider';
import SessionProvider from '@/session/SessionProvider';

import Canvas from '@/views/Canvas';
import DocumentBar from '@/views/DocumentBar';
import PropertiesPanel from '@/views/PropertiesPanel';
import ToolBar from '@/views/ToolBar';

const App = () => {
  return (
    <SessionProvider>
      <ContextProvider>
        <DocumentBar />
        <ToolBar />
        <Canvas />
        <PropertiesPanel />
      </ContextProvider>
    </SessionProvider>
  );
};

export default App;
