import {
  Client,
  Database,
  Embed,
  GatewayIntents,
  Guild,
  Interaction,
  Message,
  MongoClient,
  Role,
  serve,
  TextChannel,
} from "./deps.ts";

const client = new Client({
  intents: [
    GatewayIntents.GUILDS,
    GatewayIntents.GUILD_MESSAGES,
  ],
  token: Deno.env.get("DISCORD_BOT_TOKEN"),
});

const mongo = new MongoClient();
console.log("attempting to login to mongo services");
const database = await mongo.connect(
  `${Deno.env.get("MONGO_SRV")}&authMechanism=SCRAM-SHA-1`,
);
console.log("logged into mongo services");

let guild: Guild | undefined = undefined;
let channel: TextChannel | undefined = undefined;
let channel_support_id = `${Deno.env.get("CHANNEL_ID_SUPPORT")}`;
let channel_announce: TextChannel | undefined = undefined;
let channel_appeal = `${Deno.env.get("CHANNEL_ID_APPEAL")}`;

interface BanSchema {
  _id: { $oid: string };
  link: string;
  pending: boolean;
  uid: string;
}

const bans = database.collection<BanSchema>("bans");

client.on("ready", async () => {
  await console.log("BeluBot logged in!");
  guild = await client.guilds.fetch(`${Deno.env.get("GUILD_ID")}`);
  channel = await client.channels.fetch(`${Deno.env.get("CHANNEL_ID_LOG")}`);
  channel_announce = await client.channels.fetch(
    `${Deno.env.get("CHANNEL_ID_ANNOUNCE")}`,
  );
});

client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isMessageComponent()) {
    if (interaction.customID === "accept_stage_intial") {
      await interaction.respond({
        content:
          `<@${interaction.user.id}> Are you sure you would like to **unban** <@${interaction
            .message.mentions.users.first()?.id ??
            interaction.message.content.replace("<@", "").replace(">", "")}> ?`,
        components: [
          {
            type: "ACTION_ROW",
            components: [
              {
                type: "BUTTON",
                label: "Yes, I'm sure",
                style: "GREEN",
                customID: "accept_stage_accept",
              },
              {
                type: "BUTTON",
                label: "No, cancel the unban",
                style: "RED",
                customID: "accept_stage_decline",
              },
            ],
          },
        ],
        embeds: [
          {
            title: `Responding to`,
            description: `${interaction.message.id}`,
            fields: [
              {
                name: "Jump",
                value: `[Click](https://discord.com/channels/${interaction.guild
                  ?.id}/${interaction.channel?.id}/${interaction.message.id})`,
              },
            ],
          },
        ],
        ephemeral: true,
      });
    } else if (interaction.customID === "accept_stage_decline") {
      await interaction.respond({
        type: "UPDATE_MESSAGE",
        content: `<@${interaction.message.mentions.users.first()
          ?.id}> is not about to be unbanned!`,
        components: [],
        ephemeral: true,
      });
    } else if (interaction.customID === "decline_stage_intial") {
      await interaction.respond({
        type: "UPDATE_MESSAGE",
        content: interaction.message.content,
        embeds: [
          interaction.message.embeds[0].setColor(
            parseInt("#e74c3c".replace("#", ""), 16),
          ),
        ],
        components: [],
      });
      const id = interaction.message.content.replace("<@", "").replace(">", "");
      const user = await client.users.fetch(id);
      await bans.updateMany(
        { uid: interaction.message?.mentions.users.first()?.id },
        { $set: { pending: false } },
      );
      await channel?.send({
        embed: new Embed()
          .setDescription(`\`\`\`🔒 DECLINED\`\`\``)
          .setFields([
            {
              name: "User",
              value: `${id} (\`${user.username}#${user.discriminator}\`)`,
              inline: true,
            },
            {
              name: "Responsible moderator",
              value:
                `${interaction.user.id} (\`${interaction.user.username}#${interaction.user.discriminator}\`)`,
              inline: true,
            },
            {
              name: "Time",
              value: `[<t:${Math.floor(Date.now() / 1000)}:T>]`,
              inline: true,
            },
          ])
          .addField({
            name: "Appeal message",
            value: `[Click](https://discord.com/channels/${interaction.guild
              ?.id}/${interaction.channel?.id}/${interaction.message?.id})`,
          }).setColor(parseInt("#e74c3c".replace("#", ""), 16)),
      });
    } else if (interaction.customID === "accept_stage_accept") {
      try {
        const message = await interaction.channel?.messages.fetch(
          `${interaction.message.embeds[0].description}`,
        );
        const id = message?.content.replace("<@", "").replace(">", "");
        const user = await client.users.fetch(`${id}`);
        const member = await interaction.guild?.members.fetch(user.id);
        await member?.roles.add(`${Deno.env.get("ROLE")}`, `User unbanned`);
        await guild?.bans.remove(
          interaction.message.content.replace("<@!", "").replace("> ?", "")
            .slice(-18),
        );
        await interaction.respond({
          type: "UPDATE_MESSAGE",
          content: `Successfully unbanned <@${
            interaction.message.content.replace("<@!", "").replace("> ?", "")
              .slice(-18)
          }>`,
          components: [],
        });
        message?.edit({
          embed: message.embeds[0].setColor(
            parseInt("#2ecc71".replace("#", ""), 16),
          ),
          components: [],
        });
        await bans.updateMany(
          { uid: message?.mentions.users.first()?.id },
          { $set: { pending: false } },
        );
        await channel?.send({
          embed: new Embed()
            .setDescription(`\`\`\`🔓 ACCEPTED\`\`\``)
            .setFields([
              {
                name: "User",
                value: `${id} (\`${user.username}#${user.discriminator}\`)`,
                inline: true,
              },
              {
                name: "Responsible moderator",
                value:
                  `${interaction.user.id} (\`${interaction.user.username}#${interaction.user.discriminator}\`)`,
                inline: true,
              },
              {
                name: "Time",
                value: `[<t:${Math.floor(Date.now() / 1000)}:T>]`,
                inline: true,
              },
            ])
            .addField({
              name: "Appeal message",
              value: `[Click](https://discord.com/channels/${interaction.guild
                ?.id}/${interaction.channel?.id}/${message?.id})`,
            }).setColor(parseInt("#2ecc71".replace("#", ""), 16)),
        });
        await channel_announce?.send({
          content:
            `Congratulations, <@${user.id}> you have been unbanned. Please wait for up to 30 minutes before contacting a Staff Member in <#${channel_support_id}> regarding an error. Thank you! Please leave this Discord once back in the main server.`,
        }).then(async (message: Message) => {
          await message.addReaction("✅");
        });
      } catch (e) {
        await interaction.reply({
          content: "An error occured. Are you sure the user is banned?",
          ephemeral: true,
        });
        if (e instanceof Error) {
          interaction.channel?.send(
            `${e.name} ${e.message}`.replace(`${client.token}`, ""),
          );
        }
      }
    }
  } else if (interaction.isApplicationCommand()) {
    if (interaction.name == "accept") {
      let id = ''
      let user = '';
      let discrim = ''
      if (interaction.options.length == 0 ) return
      else if (interaction.options[0].name == "user") {
        try {
          await guild?.bans.remove(
            interaction.options[0].value,
          );
          
        } catch (err) {}
        finally {
          id = interaction.options[0].value
          user = interaction.resolved.users[id].username
          discrim = interaction.resolved.users[id].discriminator
          await interaction.reply(
            `<@${interaction.options[0].value}> was manually unbanned`,
          );
          await bans.updateMany(
            { uid: interaction.options[0].value },
            { $set: { pending: false } },
          );
          await channel_announce?.send({
            content:
              `Congratulations, <@${interaction.options[0].value}> you have been unbanned. Please wait for up to 30 minutes before contacting a Staff Member in <#${channel_support_id}> regarding an error. Thank you! Please leave this Discord once back in the main server.`,
          }).then(async (message: Message) => {
            await message.addReaction("✅");
          });
        }
      } else if (interaction.options[0].name == "user_id") {
        try {
          await guild?.bans.remove(interaction.options[0].value);
        } catch (err) {}
        finally {
          id = interaction.options[0].value
          user = interaction.resolved.users[id].username
          discrim = interaction.resolved.users[id].discriminator
          await interaction.reply(
            `<@${interaction.options[0].value}> was manually unbanned`,
          );
          await bans.updateMany(
            { uid: interaction.options[0].value },
            { $set: { pending: false } },
          );
          await channel_announce?.send({
            content:
              `Congratulations, <@${interaction.options[0].value}> you have been unbanned. Please wait for up to 30 minutes before contacting a Staff Member in <#${channel_support_id}> regarding an error. Thank you! Please leave this Discord once back in the main server.`,
          }).then(async (message: Message) => {
            await message.addReaction("✅");
          });
        }
      } else if (interaction.options[0].name == "message_id") {
        const message = await client.rest.endpoints.getChannelMessage(
          channel_appeal,
          interaction.options[0].value,
        );
        try {
          await guild?.bans.remove(message.mentions[0].id);
        } catch (err) {}
        finally {
          id = message.mentions[0].id
          user = message.mentions[0].username
          discrim = message.mentions[0].discriminator
          await interaction.reply(
            `<@${message.mentions[0].id}> was manually unbanned`,
          );
          await bans.updateMany(
            { uid: message.mentions[0].id },
            { $set: { pending: false } },
          );
          await channel_announce?.send({
            content:
              `Congratulations, <@${message.mentions[0].id}> you have been unbanned. Please wait for up to 30 minutes before contacting a Staff Member in <#${channel_support_id}> regarding an error. Thank you! Please leave this Discord once back in the main server.`,
          }).then(async (message: Message) => {
            await message.addReaction("✅");
          });
        }
      }
      await channel?.send({
        embed: new Embed()
          .setDescription(`\`\`\`🔓 MANUALLY ACCEPTED\`\`\``)
          .setFields([
            {
              name: "User",
              value: `${id} (\`${user}#${discrim}\`)`,
              inline: true,
            },
            {
              name: "Responsible moderator",
              value:
                `${interaction.user.id} (\`${interaction.user.username}#${interaction.user.discriminator}\`)`,
              inline: true,
            },
            {
              name: "Time",
              value: `[<t:${Math.floor(Date.now() / 1000)}:T>]`,
              inline: true,
            },
          ])
          .setColor(parseInt("#2ecc71".replace("#", ""), 16)),
      });
    }
  }
});

client.on("messageCreate", async (message: Message) => {
  if (message.channel.id == channel_appeal) {
    if (message.embeds.length > 0) {
      await bans.insertOne({
        link: `https://discord.com/channels/${message.guild?.id}/${message
          .channel?.id}/${message?.id}`,
        pending: true,
        uid: `${message.mentions.users.first()?.id}`,
      });
    }
  }
  if (message.content == "!pending") {
    let embed = new Embed();
    embed.setAuthor("Pending Appeals");
    embed.setDescription("");
    const pending_bans = await bans.find({ pending: true }, {
      noCursorTimeout: false,
    }).toArray();
    for (let i = 0; i < pending_bans.length; i++) {
      if (pending_bans.length > 0) {
        if (parseInt(`${embed.description?.length}`) <= 3900 ) {
          embed.setDescription(
          `${embed.description}\n<@${pending_bans[i].uid}> - [Jump](${
            pending_bans[i].link
          })`,
        );
        } else {
          embed.setDescription(`${embed.description}\n and ${pending_bans.length - i} more`)
          break
        }
      }
    }
    await message.channel.send(embed);
  }
});

console.log("Start up - commencing startup (0/4)");

await console.log("Start up - commands registered (1/4)");

await console.log(`Start up - cache generated (2/4)`);

client.connect( );

const server = Deno.listen({port: 8080})
console.log(`Start up - HTTP webserver running (3/4)`);

for await (const conn of server) {
  // In order to not be blocking, we need to handle each connection individually
  // without awaiting the function
  serveHttp(conn);
}

async function serveHttp(conn: Deno.Conn) {
  // This "upgrades" a network connection into an HTTP connection.
  const httpConn = Deno.serveHttp(conn);
  // Each request sent over the HTTP connection will be yielded as an async
  // iterator from the HTTP connection.
  for await (const requestEvent of httpConn) {
    // The native HTTP server uses the web standard `Request` and `Response`
    // objects.
    const body = `Your user-agent is:\n\n${requestEvent.request.headers.get(
      "user-agent",
    ) ?? "Unknown"}`;
    // The requestEvent's `.respondWith()` method is how we send the response
    // back to the client.
    requestEvent.respondWith(
      new Response(body, {
        status: 200,
      }),
    );
  }
}
