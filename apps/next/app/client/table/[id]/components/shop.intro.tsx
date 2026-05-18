export default function ShopIntro({ tableName, tableSeats }: { tableName: string, tableSeats: number }) {
  return (
    <>
      <div className="mb-0 fr justify-between items-center py-4">
        <div className="h-full fit-content fr">
          <hr className="h-full border-slate-300 border-l-4 mr-4" />
          <div className="fc justify-center">
            <h1 className="font-extrabold text-3xl flex items-center mb-1">{"연컴 홈런포차"}</h1>
            <span className="text-xl font-semibold text-gray-500">{tableName}</span>
          </div>
        </div>
        <img src={"/" + "favicon.ico"} alt="" width={100} height={100} className="p-2 rounded-2xl" />
      </div>
    </>
  );
}