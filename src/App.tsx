import Camera from "./Camera";

function App() {
  return (
    <>
      <h1 className="text-center text-3xl font-bold underline">
        WELCOME TO DETECT LEAF
      </h1>
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Camera />
      </div>
    </>
  );
}

export default App;
