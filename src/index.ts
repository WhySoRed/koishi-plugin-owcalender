import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  Context,
  h,
  Schema,
} from "koishi";
import {} from "@koishijs/plugin-http";
import {} from "@koishijs/cache";

export const inject = ["http", "cache"];

export const name = "owcalender";

export const usage = `
来源：https://owspace.com/
`;

export interface Config {
  cacheMaxAge: number;
  cacheNotToday: boolean;
}

export const Config: Schema<Config> = Schema.object({
  cacheMaxAge: Schema.number()
    .default(24 * 60 * 60 * 1000)
    .description("图片的缓存保留时间，默认为24 * 60 * 60 * 1000毫秒，即一天"),
  cacheNotToday: Schema.boolean()
    .default(false)
    .description("是否缓存非当日的单向历"),
});

declare module "@koishijs/cache" {
  interface Tables {
    owcalender: string;
  }
}

export function apply(ctx: Context, config: Config) {
  // 获取格式为yyyy/mmdd的东八区的时间字符串
  function getdateStr(date?: string) {
    date =
      date ||
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Shanghai",
      });
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    return `${year}/${month.toString().padStart(2, "0")}${day
      .toString()
      .padStart(2, "0")}`;
  }

  ctx
    .command("单向历", '"致时光以生命"')
    .action(async ({ session }, dateStr) => {
      if (dateStr === "help" || dateStr === "帮助") {
        session.execute("help 单向历");
        return;
      }
      if (dateStr === "随机") {
        const startDate = new Date("2015-02-18T00:00:00+08:00").getTime();
        const endDate = new Date().getTime();
        const randomDate = new Date(
          startDate + Math.random() * (endDate - startDate)
        ).toLocaleString("en-US", {
          timeZone: "Asia/Shanghai",
        });
        dateStr = getdateStr(randomDate);
      } else if (!dateStr) {
        dateStr = getdateStr();
      } else if (
        !/^\d{4}\/\d{4}$/.test(dateStr) ||
        +dateStr.slice(5, 7) > 12 ||
        +dateStr.slice(7, 9) > 31
      ) {
        session.send("日期格式错误，正确格式为yyyy/mmdd，如" + getdateStr());
        return;
      } else if (+dateStr.replace("/", "") < 20150218) {
        console.log(+(dateStr.slice(5, 7) + dateStr.slice(7, 9)));
        return '"忌留念"';
      } else if (+dateStr.replace("/", "") > +getdateStr().replace("/", "")) {
        return '"宜期待"';
      }

      const owcalenderBase64String = await ctx.cache.get("owcalender", dateStr);

      if (owcalenderBase64String) {
        const image = base64ToArrayBuffer(owcalenderBase64String);
        session.send(h.image(image, "image/png"));
        return;
      }

      const url = `https://img.owspace.com/Public/uploads/Download/${dateStr}.jpg`;

      await ctx.http
        .get(url)
        .then(async (res: ArrayBuffer) => {
          const owcalenderBase64String = arrayBufferToBase64(res);
          if (!owcalenderBase64String) {
            session.send("获取单向历失败");
            return;
          }
          if (config.cacheNotToday || dateStr === getdateStr())
            await ctx.cache.set(
              "owcalender",
              dateStr,
              owcalenderBase64String,
              config.cacheMaxAge
            );
          session.send(h.image(res, "image/png"));
          return;
        })
        .catch((err) => {
          session.send("获取单向历失败");
        });
    })
    .usage(
      `=============\n` +
        `获取今天的单向历\n\n` +
        `可以附带参数来指定日期\n` +
        `格式为yyyy/mmdd\n` +
        `如"单向历 ${getdateStr()}\n\n"` +
        `通过"单向历 随机"\n` +
        `可以获取随机日期的单向历\n`
    );
}
